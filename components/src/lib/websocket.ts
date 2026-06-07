/**
 * WebSocket client for real-time updates between client panel and main panel.
 */
import { api } from './api';

type WebSocketMessage = {
    type: string;
    [key: string]: any;
};

type WebSocketEventHandler = (data: any) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private isConnecting = false;
    private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
    private pingInterval: number | null = null;
    private turfSubscriptions: Set<string> = new Set();

    constructor() {
        // Auto-reconnect on page visibility change
        if (typeof window !== 'undefined') {
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !this.ws) {
                    this.connect();
                }
            });
        }
    }

    /**
     * Connect to WebSocket server
     */
    async connect(token?: string): Promise<void> {
        if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.isConnecting = true;

        try {
            // Get token if not provided
            const accessToken = token || localStorage.getItem('access_token');
            if (!accessToken) {
                console.warn('No access token available for WebSocket connection');
                this.isConnecting = false;
                return;
            }

            // Determine WebSocket URL
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = import.meta.env.VITE_API_HOST || window.location.host;
            const wsUrl = `${wsProtocol}//${wsHost}/api/ws/client/${accessToken}`;

            console.log('Connecting to WebSocket:', wsUrl);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;

                // Start ping interval
                this.startPingInterval();

                // Resubscribe to previously subscribed turfs
                this.turfSubscriptions.forEach(turfId => {
                    this.subscribeToTurf(turfId);
                });

                this.emit('connected', {});
            };

            this.ws.onmessage = (event) => {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.ws = null;
                this.isConnecting = false;
                this.stopPingInterval();

                this.emit('disconnected', { code: event.code, reason: event.reason });

                // Attempt reconnection
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        this.connect();
                    }, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts));
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
                this.emit('error', { error });
            };

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.isConnecting = false;
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnected');
            this.ws = null;
        }
        this.stopPingInterval();
        this.isConnecting = false;
    }

    /**
     * Send message to WebSocket server
     */
    send(message: WebSocketMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }

    /**
     * Subscribe to updates for a specific turf
     */
    subscribeToTurf(turfId: string): void {
        this.turfSubscriptions.add(turfId);

        this.send({
            type: 'subscribe',
            turf_id: turfId,
            timestamp: Date.now()
        });
    }

    /**
     * Unsubscribe from updates for a specific turf
     */
    unsubscribeFromTurf(turfId: string): void {
        this.turfSubscriptions.delete(turfId);

        this.send({
            type: 'unsubscribe',
            turf_id: turfId,
            timestamp: Date.now()
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage(data: WebSocketMessage): void {
        const { type, ...payload } = data;

        // Emit event for specific message type
        this.emit(type, payload);

        // Also emit generic message event
        this.emit('message', { type, ...payload });

        // Handle specific message types
        switch (type) {
            case 'booking_updated':
                console.log('Booking updated:', payload);
                // Update local state or trigger refresh
                break;

            case 'slot_updated':
                console.log('Slot updated:', payload);
                // Update local state or trigger refresh
                break;

            case 'pong':
                // Ping response, no action needed
                break;

            case 'subscribed':
                console.log('Subscribed to turf:', payload.turf_id);
                break;

            case 'unsubscribed':
                console.log('Unsubscribed from turf:', payload.turf_id);
                break;

            case 'error':
                console.error('WebSocket error:', payload.message);
                break;

            default:
                console.log('Unknown message type:', type, payload);
        }
    }

    /**
     * Start ping interval to keep connection alive
     */
    private startPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = window.setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'ping',
                    timestamp: Date.now()
                });
            }
        }, 30000); // Ping every 30 seconds
    }

    /**
     * Stop ping interval
     */
    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Register event handler
     */
    on(event: string, handler: WebSocketEventHandler): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }

        this.eventHandlers.get(event)!.add(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.eventHandlers.get(event);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.eventHandlers.delete(event);
                }
            }
        };
    }

    /**
     * Emit event to all registered handlers
     */
    private emit(event: string, data: any): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get connection status
     */
    getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
        if (this.isConnecting) return 'connecting';
        if (this.isConnected()) return 'connected';
        if (this.ws?.readyState === WebSocket.CLOSED) return 'disconnected';
        return 'error';
    }
}

// Create singleton instance
export const websocket = new WebSocketClient();

/**
 * Hook for using WebSocket in React components
 */
export function useWebSocket() {
    return {
        connect: websocket.connect.bind(websocket),
        disconnect: websocket.disconnect.bind(websocket),
        send: websocket.send.bind(websocket),
        subscribeToTurf: websocket.subscribeToTurf.bind(websocket),
        unsubscribeFromTurf: websocket.unsubscribeFromTurf.bind(websocket),
        on: websocket.on.bind(websocket),
        isConnected: websocket.isConnected.bind(websocket),
        getStatus: websocket.getStatus.bind(websocket)
    };
}

/**
 * Helper to send booking update notification from main panel
 */
export async function notifyBookingUpdate(turfId: string, bookingData: any): Promise<void> {
    try {
        // In a real implementation, this would send to the main panel WebSocket
        // For now, we'll just log it
        console.log('Notifying booking update:', { turfId, bookingData });

        // If we have a WebSocket connection, send the update
        if (websocket.isConnected()) {
            websocket.send({
                type: 'booking_update',
                turf_id: turfId,
                booking: bookingData,
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('Error notifying booking update:', error);
    }
}

/**
 * Helper to send slot update notification from main panel
 */
export async function notifySlotUpdate(turfId: string, slotData: any): Promise<void> {
    try {
        console.log('Notifying slot update:', { turfId, slotData });

        if (websocket.isConnected()) {
            websocket.send({
                type: 'slot_update',
                turf_id: turfId,
                slot: slotData,
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('Error notifying slot update:', error);
    }
}