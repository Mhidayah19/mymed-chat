import { MapPin, Stethoscope, User } from "@phosphor-icons/react";

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

interface CachedTemplatesData {
  type: 'cached-templates' | 'templates';
  templates?: CachedTemplate[];
  count?: number;
  status?: string;
}

// Component that accepts either parsed or raw data
export const CachedTemplatesCard = ({ 
  data, 
  rawResult 
}: { 
  data?: CachedTemplatesData;
  rawResult?: any;
}) => {
  // Use raw result if provided, otherwise use parsed data
  const templatesData = rawResult || data;
  
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

  // Create a list view for the templates
  return (
    <div className="my-4 space-y-4">
      {templates.map((template: CachedTemplate, index: number) => (
        <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
          <div className="flex items-center justify-between flex-1">
            {/* Hospital Icon and Name */}
            <div className="flex items-start gap-4 w-[400px]">
              <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-gray-600 font-medium">HOSP</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-medium text-gray-900 leading-tight">
                  {template.customer}
                </h3>
                <p className="text-sm text-gray-600">({template.customerId})</p>
              </div>
            </div>

            {/* Set, Surgeon, and Rep Info */}
            <div className="flex-1 px-8">
              <div className="text-sm text-gray-600">
                <p>Set: {template.equipment || template.reservationType || 'N/A'}</p>
                <p>Surgeon: {template.surgeon || 'N/A'}</p>
                <p>Rep: {template.salesRep || template.salesrep || 'N/A'}</p>
              </div>
            </div>

            {/* Confidence Score */}
            <div className="flex-shrink-0 pl-8">
              <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white font-semibold">
                  {template.confidence ? `${template.confidence}%` : '89%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
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