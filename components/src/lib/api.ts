import {
  type Banner,
  type Turf,
  type Offer,
  type Tournament,
  type Booking,
  type Review,
} from "@/data/seed";
import { getSupabase, withTimeout } from "./supabase";

import { distanceKm } from "./api/turfs";

import * as bannersModule from "./api/banners";
import * as turfsModule from "./api/turfs";
import * as bookingsModule from "./api/bookings";
import * as tournamentsModule from "./api/tournaments";
import * as authModule from "./api/auth";
import * as adminModule from "./api/admin";
import * as feedbackModule from "./api/feedback";
import * as openGamesModule from "./api/openGames";

export const api = {
  // Open Games
  listOpenGames: (filters?: Parameters<typeof openGamesModule.listOpenGames>[0]) => openGamesModule.listOpenGames(filters),
  getOpenGame: (id: string) => openGamesModule.getOpenGame(id),
  joinOpenGame: (gameId: string, paymentMethod?: string) => openGamesModule.joinOpenGame(gameId, paymentMethod),
  requestJoinOpenGame: (gameId: string) => openGamesModule.requestJoinOpenGame(gameId),
  payPrivateGameShare: (gameId: string, paymentMethod?: string) => openGamesModule.payPrivateGameShare(gameId, paymentMethod),
  approveJoinRequest: (gameId: string, playerId: string) => openGamesModule.approveJoinRequest(gameId, playerId),
  rejectJoinRequest: (gameId: string, playerId: string) => openGamesModule.rejectJoinRequest(gameId, playerId),
  leaveOpenGame: (gameId: string) => openGamesModule.leaveOpenGame(gameId),
  cancelOpenGame: (gameId: string) => openGamesModule.cancelOpenGame(gameId),
  hostOpenGame: (payload: Parameters<typeof openGamesModule.hostOpenGame>[0]) => openGamesModule.hostOpenGame(payload),
  // Banners
  listBanners: () => bannersModule.listBanners(),

  // Turfs
  listTurfs: (opts?: Parameters<typeof turfsModule.listTurfs>[0]) => turfsModule.listTurfs(opts),
  getTurf: (id: string) => turfsModule.getTurf(id),
  distanceKm,

  // Favorites
  listFavorites: () => turfsModule.listFavorites(() => authModule.me()),
  toggleFavorite: (turfId: string) => turfsModule.toggleFavorite(turfId, () => authModule.me()),

  // Reviews
  listReviews: (turfId: string) => turfsModule.listReviews(turfId),
  addReview: (turfId: string, rating: number, comment: string) =>
    turfsModule.addReview(turfId, rating, comment, () => authModule.me()),

  // Offers
  async listOffers(): Promise<Offer[]> {
    const supabase = await getSupabase();
    const { data, error } = await withTimeout(
      supabase.from("offers").select("*").eq("is_active", true)
    );
    if (error) throw error;
    return (data || []) as Offer[];
  },

  // Tournaments
  listTournaments: () => tournamentsModule.listTournaments(),
  getTournament: (id: string) => tournamentsModule.getTournament(id),

  // Auth
  requestOtp: (phone: string) => authModule.requestOtp(phone),
  verifyOtp: (payload: authModule.OtpVerifyPayload) =>
    authModule.verifyOtp(payload, () => authModule.me()),
  me: () => authModule.me(),
  exchangeSession: (sessionId: string) =>
    authModule.exchangeSession(sessionId, () => authModule.me()),
  adminPasswordSignIn: (email: string, password: string) =>
    authModule.adminPasswordSignIn(email, password, () => authModule.me()),
  clientLogin: (clientId: string, password: string) =>
    authModule.clientLogin(clientId, password, () => authModule.me()),
  logout: () => authModule.logout(),

  // Bookings
  createBooking: (payload: Parameters<typeof bookingsModule.createBooking>[0]) =>
    bookingsModule.createBooking(payload, (id) => turfsModule.getTurf(id), () => authModule.me()),
  bookedSlots: (turfId: string, date: string) => bookingsModule.bookedSlots(turfId, date),
  payMock: (bookingId: string) => bookingsModule.payMock(bookingId),
  myBookings: () => bookingsModule.myBookings(() => authModule.me()),
  upcomingBookings: () => bookingsModule.upcomingBookings(() => authModule.me()),
  getBooking: (id: string) => bookingsModule.getBooking(id),
  cancelBooking: (id: string) => bookingsModule.cancelBooking(id),

  // Feedback
  submitFeedback: (payload: feedbackModule.FeedbackPayload) => feedbackModule.submitFeedback(payload, () => authModule.me()),
  uploadScreenshot: (file: File) => feedbackModule.uploadScreenshot(file),

  // Admin
  admin: {
    addTurf: (t: Partial<Turf>) => adminModule.addTurf(t),
    updateTurf: (id: string, patch: Partial<Turf>) => adminModule.updateTurf(id, patch),
    deleteTurf: (id: string) => adminModule.deleteTurf(id),
    addBanner: (b: Partial<Banner>) => adminModule.addBanner(b),
    deleteBanner: (id: string) => adminModule.deleteBanner(id),
    addOffer: (o: Partial<Offer>) => adminModule.addOffer(o),
    deleteOffer: (id: string) => adminModule.deleteOffer(id),
    addTournament: (t: Partial<Tournament>) => adminModule.addTournament(t),
    deleteTournament: (id: string) => adminModule.deleteTournament(id),
    listAllBookings: () => adminModule.listAllBookings(),
    listFeedback: () => adminModule.listFeedback(),
    updateFeedbackStatus: (id: string, payload: any) => adminModule.updateFeedbackStatus(id, payload),
    listBetaUsers: () => adminModule.listBetaUsers(),
    inviteBetaUser: (email: string, notes?: string) => adminModule.inviteBetaUser(email, notes),
    updateBetaUserStatus: (id: string, status: string) => adminModule.updateBetaUserStatus(id, status),
    getSystemHealth: () => adminModule.getSystemHealth(),
  },
};

export const isMockMode = false;
export const session = {
  getAccessToken: () => null,
  setAccessToken: () => {},
  clear: () => {},
};
