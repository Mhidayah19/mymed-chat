import { useState, useEffect } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import { agentFetch } from "agents/client";
import {
  ArrowClockwise,
  Warning,
  FileText,
} from "@phosphor-icons/react";

interface BookingTemplate {
  customer: string;
  customerId: string;
  equipment: string;
  surgeon: string;
  salesrep: string;
  frequency: number;
  totalBookings: number;
}

interface BookingTemplatesData {
  success: boolean;
  message: string;
  templates: BookingTemplate[];
  generatedAt: string;
  sourceBookings: number;
}

interface BookingRecommendationsProps {
  agent: { host: string };
}

const BookingRecommendations = ({ agent }: BookingRecommendationsProps) => {
  const [bookingTemplates, setBookingTemplates] = useState<BookingTemplate[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookingTemplates = async () => {
    try {
      // First try to get cached templates
      const cachedResponse = await agentFetch({
        agent: "booking-analysis-agent",
        host: agent.host,
        name: "main-analyzer",
        path: "cached-templates",
      });

      if (cachedResponse.ok) {
        const cachedData = (await cachedResponse.json()) as BookingTemplatesData;
        console.log("Cached templates response:", cachedData);
        if (cachedData.success && cachedData.templates && Array.isArray(cachedData.templates) && cachedData.templates.length > 0) {
          setBookingTemplates(cachedData.templates);
          return; // Use cached templates
        }
      }

      // If no cached templates, generate new ones
      const response = await agentFetch({
        agent: "booking-analysis-agent",
        host: agent.host,
        name: "main-analyzer",
        path: "templates",
      });

      if (response.ok) {
        const data = (await response.json()) as BookingTemplatesData;
        console.log("Generated templates response:", data);
        if (data.success && data.templates && Array.isArray(data.templates)) {
          setBookingTemplates(data.templates);
        } else {
          console.warn("Invalid templates data structure:", data);
          setBookingTemplates([]);
        }
      } else {
        console.error("Failed to fetch templates:", response.status, response.statusText);
        setError("Failed to generate booking templates");
      }
    } catch (err) {
      console.error("Error fetching booking templates:", err);
      setError("Error fetching booking templates");
    }
  };

  const generateBookingTemplates = async () => {
    setIsGeneratingTemplates(true);
    setError(null); // Clear any previous errors
    try {
      await fetchBookingTemplates();
    } catch (err) {
      console.error("Error generating templates:", err);
      setError("Failed to generate booking templates");
    } finally {
      setIsGeneratingTemplates(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await fetchBookingTemplates();
      } catch (err) {
        console.error("Error during initial load:", err);
        setError("Failed to load booking templates");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    // Removed auto-refresh interval to prevent Workers hanging issues
  }, []);

  if (isLoading) {
    return (
      <Card className="p-6 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
            Loading most common bookings...
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-blue-500" />
          <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">
            Most Common Bookings
          </h3>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <Warning size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* Most Common Bookings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={generateBookingTemplates}
            disabled={isGeneratingTemplates}
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {isGeneratingTemplates ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </>
            ) : (
              <>
                <ArrowClockwise size={16} className="mr-2" />
                Show Common Bookings
              </>
            )}
          </Button>
        </div>

        {bookingTemplates.length > 0 ? (
          <div className="space-y-3">
            {bookingTemplates.map((template, index) => (
              <Card
                key={`booking-${template.customer}-${index}`}
                className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-green-400"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {template.customer || 'Unknown Customer'}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {template.totalBookings || 0} total bookings • Most common combination appears {template.frequency || 0} times
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      {Math.round(((template.frequency || 0) / (template.totalBookings || 1)) * 100)}% frequency
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div className="bg-neutral-50 dark:bg-neutral-800 p-2 rounded">
                    <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Equipment
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {template.equipment || 'Unknown Equipment'}
                    </div>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-800 p-2 rounded">
                    <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Surgeon
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {template.surgeon || 'Unknown Surgeon'}
                    </div>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-800 p-2 rounded">
                    <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Sales Rep
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {template.salesrep || 'Unknown Sales Rep'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  <Button
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => {
                      // Generate booking request body based on the most common pattern
                      const nextBusinessDay = new Date();
                      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
                      // Skip weekends
                      if (nextBusinessDay.getDay() === 0) nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
                      if (nextBusinessDay.getDay() === 6) nextBusinessDay.setDate(nextBusinessDay.getDate() + 2);
                      
                      // Create surgery schedule
                      const dayOfUse = new Date(nextBusinessDay);
                      dayOfUse.setHours(8, 0, 0, 0); // 8 AM start
                      
                      const endOfUse = new Date(nextBusinessDay);
                      endOfUse.setHours(18, 0, 0, 0); // 6 PM end
                      
                      // Delivery day before at 10 AM
                      const deliveryDate = new Date(nextBusinessDay);
                      deliveryDate.setDate(deliveryDate.getDate() - 1);
                      deliveryDate.setHours(10, 0, 0, 0);
                      
                      // Return day after at 4 PM
                      const returnDate = new Date(nextBusinessDay);
                      returnDate.setDate(returnDate.getDate() + 1);
                      returnDate.setHours(16, 0, 0, 0);

                      // Convert equipment name to material ID with null safety
                      const materialId = (template.equipment || 'UNKNOWN-EQUIPMENT').toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');

                      const bookingRequest = {
                        items: [
                          {
                            quantity: 1,
                            materialId: materialId || 'UNKNOWN-EQUIPMENT'
                          }
                        ],
                        notes: [
                          {
                            language: 'EN',
                            noteContent: `${template.equipment || 'Unknown Equipment'} - ${template.surgeon || 'Unknown Surgeon'}`
                          }
                        ],
                        isDraft: true,
                        currency: 'EUR',
                        customer: template.customerId || template.customer || 'Unknown Customer',
                        dayOfUse: dayOfUse.toISOString(),
                        endOfUse: endOfUse.toISOString(),
                        returnDate: returnDate.toISOString(),
                        description: template.equipment || 'Medical Equipment',
                        surgeryType: 'OR',
                        deliveryDate: deliveryDate.toISOString(),
                        isSimulation: true,
                        collectionDate: returnDate.toISOString(),
                        reservationType: '01',
                        surgeryDescription: `${template.surgeon || 'Unknown Surgeon'}`
                      };

                      navigator.clipboard.writeText(JSON.stringify(bookingRequest, null, 2));
                      // TODO: Add toast notification for successful copy
                    }}
                  >
                    Copy JSON
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 bg-neutral-50 dark:bg-neutral-900">
            <div className="text-center">
              <FileText size={32} className="mx-auto text-neutral-400 mb-3" />
              <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                No Common Bookings Found
              </h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Click the button above to analyze the most common booking combinations by customer.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BookingRecommendations;