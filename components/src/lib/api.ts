import {
  banners as seedBanners,
  turfs as seedTurfs,
  offers as seedOffers,
  tournaments as seedTournaments,
  type Banner,
  type Turf,
  type Offer,
  type Tournament,
  type Booking,
  type User,
  type Review,
} from "@/data/seed";
import { getSupabase } from "./supabase";
import {
  USE_MOCK,
  accessToken,
  setAccessToken,
  isOpenNow,
  uid,
} from "./api/core";

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
  joinOpenGame: (gameId: string, paymentMethod?: string) => openGamesModule.joinOpenGame(gameId, paymentMethod),
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
    if (supabase) {
      const { data, error } = await supabase.from("offers").select("*").eq("is_active", true);
      if (error) throw error;
      return data as Offer[];
    }
    await new Promise((r) => setTimeout(r, 120));
    return seedOffers;
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
  mockGoogleSignIn: (role?: "user" | "admin" | "client") => authModule.mockGoogleSignIn(role),
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
    addTurf: (t: Partial<Turf>) => adminModule.addTurf(t, seedTurfs),
    updateTurf: (id: string, patch: Partial<Turf>) => adminModule.updateTurf(id, patch),
    deleteTurf: (id: string) => adminModule.deleteTurf(id),
    addBanner: (b: Partial<Banner>) => adminModule.addBanner(b),
    deleteBanner: (id: string) => adminModule.deleteBanner(id),
    addOffer: (o: Partial<Offer>) => adminModule.addOffer(o, seedOffers),
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

export const isMockMode = USE_MOCK;
export const session = {
  getAccessToken: () => accessToken,
  setAccessToken,
  clear: () => setAccessToken(null),
};
