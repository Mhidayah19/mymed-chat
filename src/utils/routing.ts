/**
 * Routing utilities for cleaner URL path matching
 */

/**
 * Route matching utility for booking analysis endpoints
 */
export const BookingRoutes = {
  BOOKINGS: "/bookings",
  RESET: "/reset",
  TEMPLATES: "/templates",
  CACHED_TEMPLATES: "/cached-templates",
} as const;

/**
 * Pure function to match route from URL pathname
 */
export const matchRoute = (pathname: string): string | null => {
  const routes = Object.values(BookingRoutes);
  return routes.find((route) => pathname.endsWith(route)) || null;
};

/**
 * Type-safe route checker
 */
export const isBookingRoute = (
  pathname: string,
  route: (typeof BookingRoutes)[keyof typeof BookingRoutes]
): boolean => pathname.endsWith(route);
