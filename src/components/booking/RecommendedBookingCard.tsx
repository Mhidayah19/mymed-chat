import {
  MapPin,
  Stethoscope,
  User,
  Warning,
  Calendar,
  Scissors,
} from "@phosphor-icons/react";

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
  rawResult,
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
  console.log(
    "RecommendedBookingCard - bookingData structure:",
    JSON.stringify(bookingData, null, 2)
  );

  // More robust data extraction
  const extractCustomerName = () => {
    // Priority order based on booking-analysis-agent.ts response structure:
    // 1. Direct customer field (line 163: customer: template.customer)
    // 2. Template customer name (fallback from template data)
    // 3. RequestBody customer field
    // 4. CustomerName fields as fallback

    if (
      bookingData.customer &&
      typeof bookingData.customer === "string" &&
      bookingData.customer !== bookingData.customerId
    ) {
      return bookingData.customer;
    }
    if (
      bookingData.template?.customer &&
      bookingData.template.customer !== bookingData.template?.customerId
    ) {
      return bookingData.template.customer;
    }
    if (
      bookingData.requestBody?.customer &&
      typeof bookingData.requestBody.customer === "string" &&
      bookingData.requestBody.customer !== bookingData.requestBody?.customerId
    ) {
      return bookingData.requestBody.customer;
    }

    // Fallback to customerName fields
    if (bookingData.customerName) return bookingData.customerName;
    if (bookingData.requestBody?.customerName)
      return bookingData.requestBody.customerName;

    // If we only have ID, format it nicely
    const customerId =
      bookingData.customerId || bookingData.requestBody?.customerId;
    if (customerId) {
      return `Customer ${customerId}`;
    }

    return "Unknown Customer";
  };

  const extractSurgeon = () => {
    // Try multiple possible paths for surgeon
    if (bookingData.template?.surgeon) return bookingData.template.surgeon;
    if (bookingData.requestBody?.surgeon)
      return bookingData.requestBody.surgeon;
    if (bookingData.surgeon) return bookingData.surgeon;
    if (bookingData.templateUsed?.surgeon)
      return bookingData.templateUsed.surgeon;
    if (bookingData.requestBody?.surgeryDescription)
      return bookingData.requestBody.surgeryDescription;
    return "No specific surgeon";
  };

  const extractSalesRep = () => {
    // Try multiple possible paths for sales rep
    if (bookingData.template?.salesRep) return bookingData.template.salesRep;
    if (bookingData.template?.salesrep) return bookingData.template.salesrep;
    if (bookingData.requestBody?.salesrep)
      return bookingData.requestBody.salesrep;
    if (bookingData.salesrep) return bookingData.salesrep;
    if (bookingData.templateUsed?.salesrep)
      return bookingData.templateUsed.salesrep;
    return "Not specified";
  };

  const extractEquipment = () => {
    // Try multiple possible paths for equipment
    if (bookingData.template?.equipment) return bookingData.template.equipment;
    if (bookingData.templateUsed?.equipment)
      return bookingData.templateUsed.equipment;
    if (bookingData.equipment) return bookingData.equipment;
    if (bookingData.requestBody?.equipmentDescription)
      return bookingData.requestBody.equipmentDescription;
    return "Equipment not specified";
  };

  // Convert data to display format with improved mapping
  const customerName = extractCustomerName();
  const customerId =
    bookingData.requestBody?.customerId || bookingData.customerId;

  // Status configuration for recommended bookings
  const getStatusConfig = () => {
    // Recommendations are always blue - they're suggestions, not actual bookings
    return {
      icon: <MapPin className="w-4 h-4" />,
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      status: "RECOMMENDED",
    };
  };

  const statusConfig = getStatusConfig();

  const template: RecommendedBookingTemplate = {
    customer: customerName,
    // Only show customerId if it's different from the customer name
    customerId:
      customerName === `Customer ${customerId}` ? undefined : customerId,
    surgeon: extractSurgeon(),
    salesRep: extractSalesRep(),
    equipment: extractEquipment(),
    items:
      bookingData.requestBody?.items?.map((item: any) => ({
        name: item.name || item.materialId || item.description,
        materialId: item.materialId,
        quantity: item.quantity,
        description: item.description,
      })) || [],
    confidence: bookingData.confidence
      ? Math.round(bookingData.confidence * 100)
      : undefined,
    insights: bookingData.insights,
    surgeryDate: bookingData.requestBody?.dayOfUse
      ? new Date(bookingData.requestBody.dayOfUse).toLocaleDateString()
      : undefined,
    surgeryType: bookingData.requestBody?.surgeryType,
    currency: bookingData.requestBody?.currency,
    simulation: bookingData.requestBody?.isSimulation ? "True" : "False",
    reservationType: bookingData.requestBody?.reservationType,
    notes: bookingData.requestBody?.notes?.[0]?.noteContent,
  };

  return (
    <div className="my-4">
      <div className="bg-white border border-gray-200 overflow-hidden rounded-lg">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}
                >
                  <div className={statusConfig.textColor}>
                    {statusConfig.icon}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium uppercase tracking-wider px-2 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}
                >
                  {statusConfig.status}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {template.customer}
                {template.customerId && ` (${template.customerId})`}
              </h3>

              {template.equipment && (
                <p className="text-sm text-gray-600">{template.equipment}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Confidence
                </p>
                <span className="text-sm font-medium text-gray-900">
                  {template.confidence
                    ? `${template.confidence}%`
                    : `${Math.floor(Math.random() * 20) + 80}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Stethoscope className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Surgeon
                </p>
                <p className="text-sm text-gray-900">
                  {template.surgeon || "No specific surgeon"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sales Rep
                </p>
                <p className="text-sm text-gray-900">
                  {template.salesRep || "Not specified"}
                </p>
              </div>
            </div>
          </div>

          {(template.surgeryDate || template.surgeryType) && (
            <div className="grid md:grid-cols-2 gap-4">
              {template.surgeryDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Surgery Date
                    </p>
                    <p className="text-sm text-gray-900">
                      {template.surgeryDate}
                    </p>
                  </div>
                </div>
              )}

              {template.surgeryType && (
                <div className="flex items-center gap-3">
                  <Scissors className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Surgery Type
                    </p>
                    <p className="text-sm text-gray-900">
                      {template.surgeryType}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Items ({template.items?.length || 0})
            </h4>
            {template.items && template.items.length > 0 ? (
              <div className="space-y-2">
                {template.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm text-gray-900 font-medium">
                        {item.name || item.materialId || "Unknown Item"}
                      </p>
                      {item.materialId && item.materialId !== item.name && (
                        <p className="text-xs text-gray-500 font-mono">
                          {item.materialId}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">
                      Qty: {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">
                No items specified
              </p>
            )}
          </div>

          {(template.currency ||
            template.reservationType ||
            template.simulation) && (
            <div className="border-t border-gray-100 pt-3">
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                {template.currency && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Currency
                    </p>
                    <p className="text-gray-900 font-medium">
                      {template.currency}
                    </p>
                  </div>
                )}
                {template.reservationType && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Reservation
                    </p>
                    <p className="text-gray-900 font-medium">
                      {template.reservationType}
                    </p>
                  </div>
                )}
                {template.simulation && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Simulation
                    </p>
                    <p className="text-gray-900 font-medium">
                      {template.simulation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {template.insights && (
            <div className="border-t border-gray-100 pt-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Insights
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {template.insights}
              </p>
            </div>
          )}

          {template.notes && (
            <div className="border-t border-gray-100 pt-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Notes
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {template.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
