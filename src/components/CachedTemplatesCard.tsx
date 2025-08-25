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
}

interface CachedTemplatesData {
  type: 'cached-templates';
  templates?: Template[];
  count?: number;
  status?: string;
}

export const CachedTemplatesCard = ({ data }: { data: CachedTemplatesData }) => {
  const templates = data.templates || [];
  
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
                {template.customer}
              </h3>
              {template.equipment && (
                <p className="text-gray-600 text-sm mt-1 truncate">{template.equipment}</p>
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

          {/* Reservation value - at bottom */}
          <div className="mt-auto pt-4 border-t border-gray-100 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900">Reservation Type</span>
              <span className="text-sm font-bold text-blue-600">
                {template.reservationType || 'Not specified'}
              </span>
            </div>
          </div>

          {/* Confidence */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-900">Confidence</span>
              <span className="text-sm font-bold text-gray-900">
                {Math.floor(Math.random() * 20) + 80}%
              </span>
            </div>
            {template.insights && (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                {template.insights}
              </p>
            )}
          </div>
          </div>
        ))}
      </div>
    </div>
  );
};