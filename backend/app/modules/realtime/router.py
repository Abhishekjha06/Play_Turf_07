"""
WebSocket router for real-time updates between client panel and main panel.
"""
import json
import asyncio
from typing import Dict, Set
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.deps import get_current_user_ws

router = APIRouter(prefix="/ws", tags=["websocket"])


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        # client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # turf_id -> set of client_ids
        self.turf_subscriptions: Dict[str, Set[str]] = {}
        # client_id -> set of turf_ids
        self.client_subscriptions: Dict[str, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept connection and store."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.client_subscriptions[client_id] = set()
        print(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        """Remove connection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        # Remove from all subscriptions
        if client_id in self.client_subscriptions:
            for turf_id in self.client_subscriptions[client_id]:
                if turf_id in self.turf_subscriptions:
                    self.turf_subscriptions[turf_id].discard(client_id)
                    if not self.turf_subscriptions[turf_id]:
                        del self.turf_subscriptions[turf_id]
            del self.client_subscriptions[client_id]
        print(f"Client {client_id} disconnected")
    
    def subscribe_to_turf(self, client_id: str, turf_id: str):
        """Subscribe client to updates for a specific turf."""
        if client_id not in self.client_subscriptions:
            self.client_subscriptions[client_id] = set()
        self.client_subscriptions[client_id].add(turf_id)
        
        if turf_id not in self.turf_subscriptions:
            self.turf_subscriptions[turf_id] = set()
        self.turf_subscriptions[turf_id].add(client_id)
        print(f"Client {client_id} subscribed to turf {turf_id}")
    
    def unsubscribe_from_turf(self, client_id: str, turf_id: str):
        """Unsubscribe client from updates for a specific turf."""
        if client_id in self.client_subscriptions:
            self.client_subscriptions[client_id].discard(turf_id)
        if turf_id in self.turf_subscriptions:
            self.turf_subscriptions[turf_id].discard(client_id)
            if not self.turf_subscriptions[turf_id]:
                del self.turf_subscriptions[turf_id]
        print(f"Client {client_id} unsubscribed from turf {turf_id}")
    
    async def send_personal_message(self, message: dict, client_id: str):
        """Send message to a specific client."""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                print(f"Error sending to {client_id}: {e}")
    
    async def broadcast_to_turf(self, message: dict, turf_id: str):
        """Broadcast message to all clients subscribed to a turf."""
        if turf_id in self.turf_subscriptions:
            for client_id in list(self.turf_subscriptions[turf_id]):
                await self.send_personal_message(message, client_id)
    
    async def broadcast_to_all(self, message: dict):
        """Broadcast message to all connected clients."""
        for client_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, client_id)


manager = ConnectionManager()


@router.websocket("/client/{client_token}")
async def websocket_client_endpoint(
    websocket: WebSocket,
    client_token: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for client panel connections.
    Client token should be a valid JWT token for authentication.
    """
    try:
        # Authenticate client using token
        user = await get_current_user_ws(client_token, db)
        if not user or not user.client_id:
            await websocket.close(code=1008)
            return
        
        client_id = f"client_{user.id}"
        await manager.connect(websocket, client_id)
        
        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "subscribe":
                    # Subscribe to turf updates
                    turf_id = data.get("turf_id")
                    if turf_id:
                        manager.subscribe_to_turf(client_id, turf_id)
                        await manager.send_personal_message({
                            "type": "subscribed",
                            "turf_id": turf_id,
                            "message": f"Subscribed to updates for turf {turf_id}"
                        }, client_id)
                
                elif message_type == "unsubscribe":
                    # Unsubscribe from turf updates
                    turf_id = data.get("turf_id")
                    if turf_id:
                        manager.unsubscribe_from_turf(client_id, turf_id)
                        await manager.send_personal_message({
                            "type": "unsubscribed",
                            "turf_id": turf_id,
                            "message": f"Unsubscribed from updates for turf {turf_id}"
                        }, client_id)
                
                elif message_type == "ping":
                    # Keep-alive ping
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": data.get("timestamp")
                    }, client_id)
                
                else:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    }, client_id)
                    
        except WebSocketDisconnect:
            manager.disconnect(client_id)
        except Exception as e:
            print(f"WebSocket error for {client_id}: {e}")
            manager.disconnect(client_id)
            
    except Exception as e:
        print(f"Connection error: {e}")
        await websocket.close(code=1011)


@router.websocket("/main")
async def websocket_main_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for main panel connections.
    This is for admin/main panel to send updates.
    """
    client_id = f"main_{uuid4().hex[:8]}"
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "booking_update":
                # Broadcast booking update to relevant turf subscribers
                turf_id = data.get("turf_id")
                booking_data = data.get("booking")
                if turf_id:
                    await manager.broadcast_to_turf({
                        "type": "booking_updated",
                        "turf_id": turf_id,
                        "booking": booking_data,
                        "timestamp": data.get("timestamp")
                    }, turf_id)
            
            elif message_type == "slot_update":
                # Broadcast slot update to relevant turf subscribers
                turf_id = data.get("turf_id")
                slot_data = data.get("slot")
                if turf_id:
                    await manager.broadcast_to_turf({
                        "type": "slot_updated",
                        "turf_id": turf_id,
                        "slot": slot_data,
                        "timestamp": data.get("timestamp")
                    }, turf_id)
            
            elif message_type == "broadcast":
                # Broadcast to all clients
                await manager.broadcast_to_all({
                    "type": "broadcast",
                    "message": data.get("message"),
                    "timestamp": data.get("timestamp")
                })
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)


# Helper function to send updates from API endpoints
async def notify_booking_update(turf_id: str, booking_data: dict):
    """Notify all subscribers about a booking update."""
    await manager.broadcast_to_turf({
        "type": "booking_updated",
        "turf_id": turf_id,
        "booking": booking_data,
        "timestamp": asyncio.get_event_loop().time()
    }, turf_id)


async def notify_slot_update(turf_id: str, slot_data: dict):
    """Notify all subscribers about a slot update."""
    await manager.broadcast_to_turf({
        "type": "slot_updated",
        "turf_id": turf_id,
        "slot": slot_data,
        "timestamp": asyncio.get_event_loop().time()
    }, turf_id)