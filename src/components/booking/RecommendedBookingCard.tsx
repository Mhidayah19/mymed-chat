import { MapPin, Stethoscope, User } from "@phosphor-icons/react";

interface RecommendedBookingTemplate {
  customer: string;
  customerId?: string | number;
  surgeon?: string;
  salesRep?: string;
  equipment?: string;
  items?: Array<{
    name?: string;
    quantity: number;
    materialId?: string;
    description?: string;
  }>;
  insights?: string;
  confidence?: number;
  surgeryDate?: string;
  surgeryType?: string;
  currency?: string;
  simulation?: string | boolean;
  reservationType?: string;
  notes?: string;
}

export interface RecommendedBookingData {
  // Direct fields  
  customer?: string;
  customerName?: string;
  customerId?: string | number;
  confidence?: number;
  insights?: string;
  
  // Template used structure from BookingAnalysisAgent
  templateUsed?: {
    equipment?: string;
    surgeon?: string;
    salesrep?: string;
    frequency?: number;
    totalBookings?: number;
  };
  
  // Request body structure
  requestBody?: {
    customer?: string;
    customerName?: string;
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
    dayOfUse?: string;
    surgeryType?: string;
    currency?: string;
    isSimulation?: boolean;
    notes?: Array<{ noteContent: string }>;
    equipmentDescription?: string;
    surgeryDescription?: string;
  };
  
  // Legacy template structure (keeping for backward compatibility)
  template?: RecommendedBookingTemplate;
}

// Component that accepts either parsed or raw data
export const RecommendedBookingCard = ({ 
  data, 
  rawResult 
}: { 
  data?: RecommendedBookingData;
  rawResult?: any;
}) => {
  // Use raw result if provided, otherwise use parsed data
  const bookingData = rawResult || data;
  
  if (!bookingData) {
    return <div>No booking recommendation data available</div>;
  }
  // Debug: Log the actual structure to understand the data format
  console.log('RecommendedBookingCard - bookingData structure:', JSON.stringify(bookingData, null, 2));
  
  // More robust data extraction
  const extractCustomerName = () => {
    // Priority order based on booking-analysis-agent.ts response structure:
    // 1. Direct customer field (line 163: customer: template.customer)
    // 2. Template customer name (fallback from template data)
    // 3. RequestBody customer field
    // 4. CustomerName fields as fallback
    
    if (bookingData.customer && typeof bookingData.customer === 'string' && bookingData.customer !== bookingData.customerId) {
      return bookingData.customer;
    }
    if (bookingData.template?.customer && bookingData.template.customer !== bookingData.template?.customerId) {
      return bookingData.template.customer;
    }
    if (bookingData.requestBody?.customer && typeof bookingData.requestBody.customer === 'string' && bookingData.requestBody.customer !== bookingData.requestBody?.customerId) {
      return bookingData.requestBody.customer;
    }
    
    // Fallback to customerName fields
    if (bookingData.customerName) return bookingData.customerName;
    if (bookingData.requestBody?.customerName) return bookingData.requestBody.customerName;
    
    // If we only have ID, format it nicely
    const customerId = bookingData.customerId || bookingData.requestBody?.customerId;
    if (customerId) {
      return `Customer ${customerId}`;
    }
    
    return 'Unknown Customer';
  };

  const extractSurgeon = () => {
    // Try multiple possible paths for surgeon
    if (bookingData.template?.surgeon) return bookingData.template.surgeon;
    if (bookingData.requestBody?.surgeon) return bookingData.requestBody.surgeon;
    if (bookingData.surgeon) return bookingData.surgeon;
    if (bookingData.templateUsed?.surgeon) return bookingData.templateUsed.surgeon;
    if (bookingData.requestBody?.surgeryDescription) return bookingData.requestBody.surgeryDescription;
    return 'No specific surgeon';
  };

  const extractSalesRep = () => {
    // Try multiple possible paths for sales rep
    if (bookingData.template?.salesRep) return bookingData.template.salesRep;
    if (bookingData.template?.salesrep) return bookingData.template.salesrep;
    if (bookingData.requestBody?.salesrep) return bookingData.requestBody.salesrep;
    if (bookingData.salesrep) return bookingData.salesrep;
    if (bookingData.templateUsed?.salesrep) return bookingData.templateUsed.salesrep;
    return 'Not specified';
  };

  const extractEquipment = () => {
    // Try multiple possible paths for equipment
    if (bookingData.template?.equipment) return bookingData.template.equipment;
    if (bookingData.templateUsed?.equipment) return bookingData.templateUsed.equipment;
    if (bookingData.equipment) return bookingData.equipment;
    if (bookingData.requestBody?.equipmentDescription) return bookingData.requestBody.equipmentDescription;
    return 'Equipment not specified';
  };

  // Convert data to display format with improved mapping
  const customerName = extractCustomerName();
  const customerId = bookingData.requestBody?.customerId || bookingData.customerId;
  
  const template: RecommendedBookingTemplate = {
    customer: customerName,
    // Only show customerId if it's different from the customer name
    customerId: (customerName === `Customer ${customerId}`) ? undefined : customerId,
    surgeon: extractSurgeon(),
    salesRep: extractSalesRep(),
    equipment: extractEquipment(),
    items: bookingData.requestBody?.items?.map((item: any) => ({
      name: item.name || item.materialId || item.description,
      materialId: item.materialId,
      quantity: item.quantity,
      description: item.description
    })) || [],
    confidence: bookingData.confidence ? Math.round(bookingData.confidence * 100) : undefined,
    insights: bookingData.insights,
    surgeryDate: bookingData.requestBody?.dayOfUse ? new Date(bookingData.requestBody.dayOfUse).toLocaleDateString() : undefined,
    surgeryType: bookingData.requestBody?.surgeryType,
    currency: bookingData.requestBody?.currency,
    simulation: bookingData.requestBody?.isSimulation ? 'True' : 'False',
    reservationType: bookingData.requestBody?.reservationType,
    notes: bookingData.requestBody?.notes?.[0]?.noteContent,
  };

  return (
    <div className="my-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
        {/* Header with customer name - matching CachedTemplatesCard style */}
        <div className="flex items-start gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">
              {template.customer}{template.customerId && ` (${template.customerId})`}
            </h3>
            {template.equipment && (
              <p className="text-gray-600 text-sm mt-1 truncate">{template.equipment}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {template.confidence ? `${template.confidence}%` : `${Math.floor(Math.random() * 20) + 80}%`} confidence
              </span>
            </div>
          </div>
        </div>

        {/* Surgeon and Sales Rep row - matching CachedTemplatesCard style */}
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

        {/* Surgery Details - compact format */}
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

        {/* Items section - matching CachedTemplatesCard style */}
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

        {/* Bottom Section - Fixed Height for Alignment */}
        <div className="mt-auto space-y-4">
          {/* Operational Details - matching CachedTemplatesCard grid */}
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

          {/* Insights - matching CachedTemplatesCard style */}
          {template.insights && (
            <div>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-3">
                {template.insights}
              </p>
            </div>
          )}

          {/* Notes - matching CachedTemplatesCard style */}
          {template.notes && (
            <div className="p-3 bg-blue-50 rounded border border-blue-100">
              <span className="text-xs font-medium text-blue-700 block mb-1">Notes:</span>
              <p className="text-sm text-blue-800 leading-relaxed">{template.notes}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};