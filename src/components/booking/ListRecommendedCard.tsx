import { MapPin, Stethoscope, User, CaretDown, CaretUp, Bookmark } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";

interface CachedTemplate {
  customer: string;
  customerId?: string | number;
  surgeon?: string;
  salesRep?: string;
  salesrep?: string; // API returns lowercase 'r'
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

interface ListRecommendedData {
  type: 'cached-templates' | 'templates';
  templates?: CachedTemplate[];
  count?: number;
  status?: string;
}

// Component that accepts either parsed or raw data
// Simple dissolve animation CSS
const animationStyles = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
  }
`;

export const ListRecommendedCard = ({ 
  data, 
  rawResult 
}: { 
  data?: ListRecommendedData;
  rawResult?: any;
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  
  // Add animation styles to document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = animationStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);
  
  // Use raw result if provided, otherwise use parsed data
  const templatesData = rawResult || data;

  const toggleCard = (index: number) => {
    const newExpanded = new Set(expandedCards);
    
    if (expandedCards.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    
    setExpandedCards(newExpanded);
  };
  
  if (!templatesData) {
    return <div>No templates data available</div>;
  }
  const templates = templatesData.templates || [];
  
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

  // Create a list view for the templates with expandable functionality
  return (
    <div className="my-4 space-y-3">
      {templates.map((template: CachedTemplate, index: number) => {
        const isExpanded = expandedCards.has(index);
        const frequency = template.frequency || 0;
        const totalBookings = template.totalBookings || 1;
        const confidence = Math.round((frequency / totalBookings) * 100);
        
        
        return (
          <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
            {/* Compact View - Transforms when expanded */}
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
              onClick={() => toggleCard(index)}
            >
              <div className="flex items-center justify-between">
                {/* Hospital Icon and Name - Animates to header */}
                <div className={`flex items-center gap-4 min-w-0 flex-1 transition-all duration-300 ${
                  isExpanded ? 'transform' : ''
                }`}>
                  <div className="min-w-0">
                    {isExpanded && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-50">
                          <Bookmark className="w-4 h-4 text-purple-700" />
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wider px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                          TEMPLATE
                        </span>
                      </div>
                    )}
                    <h3 className={`leading-tight truncate transition-all duration-300 ${
                      isExpanded 
                        ? 'text-lg font-semibold text-gray-900' 
                        : 'text-base font-medium text-gray-900'
                    }`}>
                      {template.customer}
                      {isExpanded && template.customerId && ` (${template.customerId})`}
                    </h3>
                    {!isExpanded && (
                      <p className="text-sm text-gray-600 transition-opacity duration-300">
                        {template.equipment || template.reservationType || `(${template.customerId})`}
                      </p>
                    )}
                    {isExpanded && template.equipment && (
                      <p className="text-sm text-gray-600 transition-all duration-300 delay-100 opacity-0 animate-fade-in">
                        {template.equipment}
                      </p>
                    )}
                  </div>
                </div>

                {!isExpanded && (
                  <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    <div className="text-sm text-gray-600 text-right">
                      <span className="font-medium">
                        {template.surgeon || 'N/A'}
                      </span>
                      <span className="text-gray-400 mx-2">•</span>
                      <span className="font-medium">
                        {template.salesRep || template.salesrep || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Confidence Score & Expand Button - Morphs to Usage */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <div className={`transition-all duration-300 ${
                    isExpanded 
                      ? 'text-right' 
                      : `h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                          confidence >= 85 ? 'bg-green-100 text-green-700' :
                          confidence >= 70 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`
                  }`}>
                    {isExpanded ? (
                      <div className="animate-fade-in">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Usage
                        </p>
                        <span className="text-sm font-medium text-gray-900">
                          {frequency}/{totalBookings} times
                        </span>
                      </div>
                    ) : (
                      `${confidence}%`
                    )}
                  </div>
                  <div className="text-gray-400 transition-transform duration-300">
                    {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded View - Additional Content Only */}
            {isExpanded && (
              <div className="border-t border-gray-100 animate-fade-in">
                <div className="p-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Stethoscope className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Surgeon
                        </p>
                        <p className="text-sm text-gray-900 animate-fade-in">
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
                        <p className="text-sm text-gray-900 animate-fade-in" style={{animationDelay: '0.1s'}}>
                          {template.salesRep || template.salesrep || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

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

                  {template.reservationType && (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-center text-sm">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Reservation Type
                        </p>
                        <p className="text-gray-900 font-medium">
                          {template.reservationType}
                        </p>
                      </div>
                    </div>
                  )}

                  {(template.insights || template.suggestedNotes) && (
                    <div className="border-t border-gray-100 pt-3 space-y-3">
                      {template.insights && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Insights
                          </h4>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {template.insights}
                          </p>
                        </div>
                      )}

                      {template.suggestedNotes && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Suggested Notes
                          </h4>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {template.suggestedNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* Card view for future use
  return (
    <div className="my-4 space-y-4">
      {templates.map((template: CachedTemplate, index: number) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-600 font-medium">HOSP</span>
            </div>
            
            <div className="flex-1">
              <div className="mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {template.customer} {template.customerId && `(${template.customerId})`}
                </h3>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <p>Set: {template.equipment || template.reservationType || 'N/A'}</p>
                <p>Surgeon: {template.surgeon || 'N/A'}</p>
                <p>Rep: {template.salesRep || template.salesrep || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white font-semibold">
                {template.confidence ? `${template.confidence}%` : '89%'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  */
};