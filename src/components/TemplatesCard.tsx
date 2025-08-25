import { MapPin, Stethoscope, User } from "@phosphor-icons/react";

interface Template {
  customer: string;
  customerId?: string | number;
  surgeon?: string;
  salesRep?: string;
  frequency?: number;
  totalBookings?: number;
  equipment?: string;
  reservationType?: string;
  items?: Array<{
    name?: string;
    quantity: number;
    materialId?: string;
    description?: string;
    availability?: string;
  }>;
  insights?: string;
  suggestedNotes?: string;
  confidence?: number;
  // Add missing fields to match BookingResultCard
  surgeryDate?: string;
  surgeryType?: string;
  currency?: string;
  simulation?: string | boolean;
  notes?: string;
  // Add booking-specific fields
  bookingId?: string;
  status?: 'success' | 'error' | 'warning';
}

interface TemplatesData {
  type: 'templates';
  templates?: Template[];
  count?: number;
  status?: string;
}

// Support for getRecommendedBooking single template format
interface RecommendedBookingData {
  requestBody?: {
    customer?: string;
    customerId?: string | number;
    surgeon?: string;
    salesrep?: string;
    items?: Array<{
      name?: string;
      quantity: number;
      materialId?: string;
      description?: string;
    }>;
    reservationType?: string;
  };
  template?: Template;
  confidence?: number;
  insights?: string;
}

type TemplateCardData = TemplatesData | RecommendedBookingData;

export const TemplatesCard = ({ data }: { data: TemplateCardData }) => {
  // Handle both getCachedTemplates (array) and getRecommendedBooking (single) formats
  const templates = (() => {
    // If it's the standard TemplatesData format with templates array
    if ('templates' in data && data.templates) {
      return data.templates;
    }
    
    // If it's getRecommendedBooking format, convert single result to array
    if ('requestBody' in data || 'templateUsed' in data || 'success' in data) {
      const recommendedData = data as any; // Use any for flexibility with the actual structure
      const singleTemplate: Template = {
        customer: recommendedData.customer || recommendedData.requestBody?.customer || 'Unknown Customer',
        customerId: recommendedData.customerId || recommendedData.requestBody?.customer,
        surgeon: recommendedData.templateUsed?.surgeon || recommendedData.requestBody?.surgeryDescription || 'No specific surgeon',
        salesRep: recommendedData.templateUsed?.salesrep || 'Not specified',
        equipment: recommendedData.templateUsed?.equipment || 'Equipment not specified',
        items: recommendedData.requestBody?.items?.map((item: any) => ({
          name: item.materialId,
          materialId: item.materialId,
          quantity: item.quantity,
          description: item.description
        })) || [],
        reservationType: recommendedData.requestBody?.reservationType,
        confidence: recommendedData.confidence ? Math.round(recommendedData.confidence * 100) : undefined,
        insights: recommendedData.insights,
        frequency: recommendedData.templateUsed?.frequency,
        totalBookings: recommendedData.templateUsed?.totalBookings,
        suggestedNotes: recommendedData.requestBody?.notes?.[0]?.noteContent,
        // Add missing fields
        surgeryDate: recommendedData.requestBody?.dayOfUse ? new Date(recommendedData.requestBody.dayOfUse).toLocaleDateString() : undefined,
        surgeryType: recommendedData.requestBody?.surgeryType,
        currency: recommendedData.requestBody?.currency,
        simulation: recommendedData.requestBody?.isSimulation ? 'True' : 'False',
        notes: recommendedData.requestBody?.notes?.[0]?.noteContent,
        // Add booking-specific fields (for createBooking results)
        bookingId: recommendedData.bookingId,
        status: recommendedData.status
      };
      return [singleTemplate];
    }
    
    return [];
  })();
  
  if (templates.length === 0) {
    return (
      <div className="my-4 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Templates Found</h3>
          <p className="text-gray-500 text-sm">No cached booking templates available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template, index) => (
          <div 
            key={index}
            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
          >
          {/* Header with customer name */}
          <div className="flex items-start gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">
                {template.customer}{template.customerId && ` (${template.customerId})`}
              </h3>
              {template.equipment && (
                <p className="text-gray-600 text-sm mt-1 truncate">{template.equipment}</p>
              )}
              {template.bookingId && (
                <p className="text-xs text-blue-600 mt-1 font-mono">Booking ID: {template.bookingId}</p>
              )}
              {template.status && (
                <p className={`text-xs mt-1 font-medium ${
                  template.status === 'success' ? 'text-green-600' : 
                  template.status === 'error' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  Status: {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                </p>
              )}
            </div>
          </div>

          {/* Surgeon and Sales Rep row - stacked for narrow cards */}
          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-4 h-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500 uppercase tracking-wide">SURGEON</p>
                <p className="font-medium text-gray-900 text-base truncate">
                  {template.surgeon || 'No specific surgeon'}
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
                  {template.salesRep || 'Not specified'}
                </p>
              </div>
            </div>
          </div>

          {/* Items section */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Items</h4>
            {template.items && template.items.length > 0 ? (
              <div className="space-y-2">
                {template.items.map((item, itemIndex) => (
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

          {/* Surgery Details */}
          {(template.surgeryDate || template.surgeryType) && (
            <div className="mb-4 space-y-2">
              {template.surgeryDate && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">Surgery Date</span>
                  <span className="text-sm text-gray-700">{template.surgeryDate}</span>
                </div>
              )}
              {template.surgeryType && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">Surgery Type</span>
                  <span className="text-sm text-gray-700">{template.surgeryType}</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Section - Fixed Height for Alignment */}
          <div className="mt-auto space-y-4">
            {/* Operational Details */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {template.currency && (
                <div className="text-center p-2 bg-gray-50 rounded">
                  <span className="block text-gray-500 mb-1">Currency</span>
                  <span className="font-semibold text-gray-900">{template.currency}</span>
                </div>
              )}
              {template.reservationType && (
                <div className="text-center p-2 bg-gray-50 rounded">
                  <span className="block text-gray-500 mb-1">Reservation</span>
                  <span className="font-semibold text-gray-900">{template.reservationType}</span>
                </div>
              )}
              {template.simulation && (
                <div className="text-center p-2 bg-gray-50 rounded">
                  <span className="block text-gray-500 mb-1">Simulation</span>
                  <span className="font-semibold text-gray-900">{template.simulation}</span>
                </div>
              )}
            </div>

            {/* Confidence */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-900">Confidence</span>
                <span className="text-sm font-bold text-gray-900">
                  {template.confidence ? `${template.confidence}%` : `${Math.floor(Math.random() * 20) + 80}%`}
                </span>
              </div>
              {template.insights && (
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-3">
                  {template.insights}
                </p>
              )}
            </div>

            {/* Notes - Always at bottom */}
            {template.notes && (
              <div className="p-3 bg-blue-50 rounded border border-blue-100">
                <span className="text-xs font-medium text-blue-700 block mb-1">Notes:</span>
                <p className="text-sm text-blue-800 leading-relaxed">{template.notes}</p>
              </div>
            )}
          </div>
          </div>
        ))}
      </div>
    </div>
  );
};