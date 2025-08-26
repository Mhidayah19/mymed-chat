import { CheckCircle, XCircle, Warning, MapPin, Stethoscope, User } from "@phosphor-icons/react";

// Interface for createBooking/updateBooking results
export interface BookingResult {
  status: 'success' | 'error' | 'warning';
  bookingId?: string;
  customer: string;
  customerId?: string | number;
  message: string;
  equipment?: string;
  surgeon?: string;
  salesRep?: string;
  surgeryDate?: string;
  surgeryType?: string;
  currency?: string;
  reservationType?: string;
  simulation?: string | boolean;
  availability?: string;
  items?: Array<{
    name?: string;
    quantity: number;
    materialId?: string;
    description?: string;
    availability?: string;
  }>;
  notes?: string;
  error?: string;
}

// Parser function to extract BookingResult from raw tool result
const parseBookingResult = (rawResult: any, requestArgs?: any): BookingResult => {
  let bookingResultData: any = {};
  
  if (rawResult && typeof rawResult === 'object') {
    if ('content' in rawResult && Array.isArray(rawResult.content)) {
      const textContent = rawResult.content.find((c: any) => c.type === 'text')?.text;
      if (textContent) {
        try {
          bookingResultData = JSON.parse(textContent);
        } catch {
          bookingResultData = rawResult;
        }
      }
    } else {
      bookingResultData = rawResult;
    }
  }
  
  // Extract booking data from nested structure
  const booking = bookingResultData.booking || bookingResultData;
  
  // Extract request body data for enriching display - check for original args first
  const originalArgs = rawResult?._originalArgs || requestArgs || {};
  const requestBody = originalArgs;
  console.log('📋 BookingOperationResultCard - Request args:', JSON.stringify(requestBody, null, 2));
  console.log('📋 BookingOperationResultCard - Has original args:', !!rawResult?._originalArgs);
  
  // Transform to BookingResult format
  const status: 'success' | 'error' | 'warning' = bookingResultData.success !== false ? 'success' : 'error';
  
  // Extract customer name - prioritize request args, then booking data
  let customerName = '';
  let customerId = undefined;
  
  if (requestBody.customerName && typeof requestBody.customerName === 'string' && requestBody.customerName.trim() !== '') {
    customerName = requestBody.customerName.trim();
    customerId = requestBody.customerId || requestBody.customer;
  } else if (booking.customerName && booking.customerName.trim() !== '') {
    customerName = booking.customerName.trim();
  } else {
    customerName = `Customer ${booking.customer || requestBody.customer}`;
  }
  
  // Extract booking ID from multiple possible locations in the result
  let bookingId = undefined;
  
  // Try different paths where booking ID might be stored
  if (booking.bookingId && booking.bookingId !== '0000000000') {
    bookingId = booking.bookingId;
  } else if (booking.ID && booking.ID !== '0000000000') {
    bookingId = booking.ID;
  } else if (booking.id && booking.id !== '0000000000') {
    bookingId = booking.id;
  } else if (bookingResultData.bookingId && bookingResultData.bookingId !== '0000000000') {
    bookingId = bookingResultData.bookingId;
  } else if (bookingResultData.ID && bookingResultData.ID !== '0000000000') {
    bookingId = bookingResultData.ID;
  } else if (bookingResultData.id && bookingResultData.id !== '0000000000') {
    bookingId = bookingResultData.id;
  }
  
  console.log('📋 Extracted booking ID:', bookingId);

  return {
    status,
    bookingId: bookingId,
    customer: customerName,
    customerId: customerId,
    message: bookingResultData.success 
      ? `Booking created successfully${bookingId ? ` (ID: ${bookingId})` : ''}` 
      : 'Failed to create booking',
    equipment: requestBody.equipmentDescription || booking.description || booking.equipmentDescription || "Medical Equipment",
    surgeon: requestBody.surgeryDescription || booking.surgeryDescription || booking.surgeon || "No specific surgeon",
    salesRep: requestBody.salesrep || "Not specified", // Extract from original args that include salesrep
    surgeryDate: requestBody.dayOfUse ? new Date(requestBody.dayOfUse).toLocaleDateString() : (booking.dayOfUse ? new Date(booking.dayOfUse).toLocaleDateString() : undefined),
    surgeryType: requestBody.surgeryType || booking.surgeryType,
    currency: requestBody.currency || booking.currency,
    reservationType: requestBody.reservationType || booking.reservationType,
    simulation: requestBody.isSimulation !== undefined ? requestBody.isSimulation : booking.isSimulation,
    items: requestBody.items?.map((item: any) => ({
      name: item.description || item.materialId,
      materialId: item.materialId,
      quantity: parseInt(item.quantity) || 1
    })) || booking.items?.map((item: any) => ({
      name: item.description || item.materialId,
      materialId: item.materialId,
      quantity: parseInt(item.quantity) || 1
    })) || [],
    notes: requestBody.notes?.[0]?.noteContent || booking.notes?.[0]?.noteContent,
    error: bookingResultData.success === false ? bookingResultData.error || 'Unknown error' : undefined
  };
};

// Component that accepts either parsed or raw data
export const BookingOperationResultCard = ({ 
  data, 
  rawResult,
  requestArgs 
}: { 
  data?: BookingResult;
  rawResult?: any;
  requestArgs?: any;
}) => {
  // Parse raw result if provided, otherwise use parsed data
  const bookingResult = rawResult ? parseBookingResult(rawResult, requestArgs) : data;
  
  if (!bookingResult) {
    return <div>No booking result data available</div>;
  }

  const getStatusIcon = () => {
    switch (bookingResult.status) {
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
        return <Warning className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="my-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
        {/* Header with customer name - matching CachedTemplatesCard style */}
        <div className="flex items-start gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            bookingResult.status === 'success' ? 'bg-green-50' : 
            bookingResult.status === 'error' ? 'bg-red-50' : 'bg-yellow-50'
          }`}>
            <div className={`${
              bookingResult.status === 'success' ? 'text-green-600' : 
              bookingResult.status === 'error' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {getStatusIcon()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">
                  {bookingResult.customer}{bookingResult.customerId && ` (${bookingResult.customerId})`}
                </h3>
                {bookingResult.equipment && (
                  <p className="text-gray-600 text-sm mt-1 truncate">{bookingResult.equipment}</p>
                )}
              </div>
              {bookingResult.bookingId && (
                <div className="flex-shrink-0 ml-2">
                  <span className="text-xs text-gray-500 font-mono">#{bookingResult.bookingId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {bookingResult.error && bookingResult.status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 rounded border border-red-100">
            <span className="text-xs font-medium text-red-700 block mb-1">Error:</span>
            <p className="text-sm text-red-800 leading-relaxed">{bookingResult.error}</p>
          </div>
        )}

        {/* Surgeon and Sales Rep row - matching CachedTemplatesCard style */}
        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500 uppercase tracking-wide">SURGEON</p>
              <p className="font-medium text-gray-900 text-base truncate">
                {bookingResult.surgeon || 'No specific surgeon'}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500 uppercase tracking-wide">SALES REP</p>
              <p className="font-medium text-gray-900 text-base truncate">
                {bookingResult.salesRep || 'Not specified'}
              </p>
            </div>
          </div>
        </div>

        {/* Surgery Details - compact format */}
        {(bookingResult.surgeryDate || bookingResult.surgeryType) && (
          <div className="mb-4 space-y-2">
            {bookingResult.surgeryDate && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">Surgery Date</span>
                <span className="text-sm text-gray-700">{bookingResult.surgeryDate}</span>
              </div>
            )}
            {bookingResult.surgeryType && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">Surgery Type</span>
                <span className="text-sm text-gray-700">{bookingResult.surgeryType}</span>
              </div>
            )}
          </div>
        )}

        {/* Items section - matching CachedTemplatesCard style */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Items</h4>
          {bookingResult.items && bookingResult.items.length > 0 ? (
            <div className="space-y-2">
              {bookingResult.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between items-center p-3 bg-gray-50 rounded text-sm">
                  <span className="font-medium text-gray-900 flex-1 min-w-0 truncate">
                    {item.name || item.materialId || 'Unknown Item'}
                  </span>
                  <span className="text-gray-600 ml-2 flex-shrink-0">
                    Qty: {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded text-sm text-gray-500 text-center">
              No items specified
            </div>
          )}
        </div>

        {/* Bottom Section - Fixed Height for Alignment */}
        <div className="mt-auto space-y-4">
          {/* Operational Details - matching CachedTemplatesCard grid */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {bookingResult.currency && (
              <div className="text-center p-2 bg-gray-50 rounded">
                <span className="block text-gray-500 mb-1">Currency</span>
                <span className="font-semibold text-gray-900">{bookingResult.currency}</span>
              </div>
            )}
            {bookingResult.reservationType && (
              <div className="text-center p-2 bg-gray-50 rounded">
                <span className="block text-gray-500 mb-1">Reservation</span>
                <span className="font-semibold text-gray-900">{bookingResult.reservationType}</span>
              </div>
            )}
            {bookingResult.simulation !== undefined && (
              <div className="text-center p-2 bg-gray-50 rounded">
                <span className="block text-gray-500 mb-1">Simulation</span>
                <span className="font-semibold text-gray-900">
                  {typeof bookingResult.simulation === 'boolean' 
                    ? (bookingResult.simulation ? 'Yes' : 'No') 
                    : bookingResult.simulation}
                </span>
              </div>
            )}
          </div>

          {/* Notes - matching CachedTemplatesCard style */}
          {bookingResult.notes && (
            <div className="p-3 bg-blue-50 rounded border border-blue-100">
              <span className="text-xs font-medium text-blue-700 block mb-1">Notes:</span>
              <p className="text-sm text-blue-800 leading-relaxed">{bookingResult.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};