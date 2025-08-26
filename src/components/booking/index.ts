// Barrel exports for booking components

// Cached templates display (getCachedTemplates tool)
export { CachedTemplatesCard } from './CachedTemplatesCard';

// Recommended booking display (getRecommendedBooking tool) 
export { 
  RecommendedBookingCard,
  type RecommendedBookingData
} from './RecommendedBookingCard';

// Booking operation results (createBooking/updateBooking tools)
export { 
  BookingOperationResultCard,
  type BookingResult
} from './BookingResultCard';

// Legacy components (keeping for backward compatibility)
export { default as BookingRecommendations } from './BookingRecommendations';
export { ChatBookingCard } from './ChatBookingCard';