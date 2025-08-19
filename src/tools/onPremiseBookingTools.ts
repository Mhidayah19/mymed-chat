/**
 * On-premise booking-related tools for the mymediset chat
 */
import { tool } from "ai";
import { z } from "zod";
import { fetchApi, fetchApiWithParams } from "../utils/apiUtils";

// On-premise API base path
const ON_PREMISE_API_PATH = '/mobilesrep/BookingSet';

/**
 * Booking information tool that executes automatically
 * No human confirmation required
 */
export const getBookingInformation = tool({
  description: "retrieve booking information from the on-premise booking API",
  parameters: z.object({ 
    bookingId: z.string().describe("The ID of the booking to retrieve"),
    isActiveEntity: z.boolean().describe("Whether the booking is active or in draft state")
  }),
  execute: async ({ bookingId, isActiveEntity }) => {
    console.log(`Fetching on-premise booking information for booking ID: ${bookingId}, isActiveEntity: ${isActiveEntity}`);
    
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('$expand', '*');
      
      // Use fetchApi for the API call with the full path
      const bookingInfo = await fetchApi(
        `${ON_PREMISE_API_PATH}(ID=${bookingId},IsActiveEntity=${isActiveEntity})?${queryParams.toString()}`,
        {},
        'onpremise'
      );
      
      return bookingInfo;
    } catch (error) {
      console.error(`Error fetching on-premise booking information: ${error}`);
      return `Failed to retrieve on-premise booking information for ID ${bookingId}: ${error}`;
    }
  },
});

/**
 * Tool to get all bookings from the on-premise API
 * No human confirmation required
 */
export const getAllBookings = tool({
  description: "retrieve all bookings from the on-premise booking API",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of bookings to retrieve"),
    offset: z.number().optional().describe("Number of bookings to skip for pagination"),
    status: z.string().optional().describe("Filter bookings by status (e.g., 'confirmed', 'cancelled', 'pending')")
  }),
  execute: async ({ limit = 10, offset = 0, status = '' }) => {
    console.log(`Fetching all on-premise bookings with limit: ${limit}, offset: ${offset}, status: ${status}`);
    
    try {
      // Build query parameters
      const params: Record<string, string | number | undefined> = {
        '$top': limit,
        '$skip': offset,
        '$expand': '*'
      };
      
      if (status) {
        params['$filter'] = `status eq '${status}'`;
      }
      
      // Use fetchApiWithParams for the API call with the full path
      const bookings = await fetchApiWithParams(
        ON_PREMISE_API_PATH,
        params,
        {},
        'onpremise'
      );
      
      return bookings;
    } catch (error) {
      console.error(`Error fetching all on-premise bookings: ${error}`);
      return `Failed to retrieve on-premise bookings: ${error}`;
    }
  },
});

/**
 * Tool to get all booking types from the on-premise API
 * No human confirmation required
 */
export const getBookingTypes = tool({
  description: "Retrieve all booking types and their descriptions from the on-premise API",
  parameters: z.object({}),
  execute: async () => {
    console.log(`Fetching all on-premise booking types`);
    
    try {
      // Use fetchApi for the API call with the full path
      const bookingTypes = await fetchApi(
        `${ON_PREMISE_API_PATH}/BookingTypes`,
        {},
        'onpremise'
      );
      
      return bookingTypes;
    } catch (error) {
      console.error(`Error fetching on-premise booking types: ${error}`);
      return `Failed to retrieve on-premise booking types: ${error}`;
    }
  },
});

/**
 * Tool to get all customers (soldTo) from the on-premise API
 * No human confirmation required
 */
export const getCustomers = tool({
  description: "Retrieve a list of customers (soldTo) from the on-premise API",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of customers to retrieve"),
    offset: z.number().optional().describe("Number of customers to skip for pagination"),
    search: z.string().optional().describe("Search term to filter customers by name or ID")
  }),
  execute: async ({ limit = 10, offset = 0, search = '' }) => {
    console.log(`Fetching on-premise customers with limit: ${limit}, offset: ${offset}, search: ${search}`);
    
    try {
      // Build query parameters
      const params: Record<string, string | number | undefined> = {
        '$top': limit,
        '$skip': offset
      };
      
      if (search) {
        params['$search'] = search;
      }
      
      // Use fetchApiWithParams for the API call with the full path
      const customers = await fetchApiWithParams(
        `${ON_PREMISE_API_PATH}/Customers`,
        params,
        {},
        'onpremise'
      );
      
      return customers;
    } catch (error) {
      console.error(`Error fetching on-premise customers: ${error}`);
      return `Failed to retrieve on-premise customers: ${error}`;
    }
  },
});

/**
 * Tool to get all shipping addresses (shipTo) from the on-premise API
 * No human confirmation required
 */
export const getShipToAddresses = tool({
  description: "Retrieve a list of shipping addresses (shipTo) from the on-premise API",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of shipping addresses to retrieve"),
    offset: z.number().optional().describe("Number of shipping addresses to skip for pagination"),
    search: z.string().optional().describe("Search term to filter shipping addresses by name, ID or location"),
    customerId: z.string().optional().describe("Filter shipping addresses by customer ID (soldTo)")
  }),
  execute: async ({ limit = 10, offset = 0, search = '', customerId = '' }) => {
    console.log(`Fetching on-premise shipping addresses with limit: ${limit}, offset: ${offset}, search: ${search}, customerId: ${customerId}`);
    
    try {
      // Build query parameters
      const params: Record<string, string | number | undefined> = {
        '$top': limit,
        '$skip': offset
      };
      
      if (search) {
        params['$search'] = search;
      }
      
      // Add filter for customer ID if provided
      if (customerId) {
        params['$filter'] = `soldTo_ID eq '${customerId}'`;
      }
      
      // Use fetchApiWithParams for the API call with the full path
      const shipToAddresses = await fetchApiWithParams(
        `${ON_PREMISE_API_PATH}/BusinessPartners`,
        params,
        {},
        'onpremise'
      );
      
      return shipToAddresses;
    } catch (error) {
      console.error(`Error fetching on-premise shipping addresses: ${error}`);
      return `Failed to retrieve on-premise shipping addresses: ${error}`;
    }
  },
});

/**
 * Tool to get all materials from the on-premise API
 * No human confirmation required
 */
export const getMaterials = tool({
  description: "Retrieve a list of available materials from the on-premise API",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of materials to retrieve"),
    offset: z.number().optional().describe("Number of materials to skip for pagination"),
    search: z.string().optional().describe("Search term to filter materials by name, ID, or description"),
    category: z.string().optional().describe("Filter materials by category")
  }),
  execute: async ({ limit = 10, offset = 0, search = '', category = '' }) => {
    console.log(`Fetching on-premise materials with limit: ${limit}, offset: ${offset}, search: ${search}, category: ${category}`);
    
    try {
      // Build query parameters
      const params: Record<string, string | number | undefined> = {
        '$top': limit,
        '$skip': offset
      };
      
      if (search) {
        params['$search'] = search;
      }
      
      // Add filter for category if provided
      if (category) {
        params['$filter'] = `category eq '${category}'`;
      }
      
      // Use fetchApiWithParams for the API call with the full path
      const materials = await fetchApiWithParams(
        `${ON_PREMISE_API_PATH}/Materials`,
        params,
        {},
        'onpremise'
      );
      
      return materials;
    } catch (error) {
      console.error(`Error fetching on-premise materials: ${error}`);
      return `Failed to retrieve on-premise materials: ${error}`;
    }
  },
});

/**
 * Create Booking tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
export const createBooking = tool({
  description: "create a new booking in the on-premise booking system",
  parameters: z.object({ 
    soldTo_ID: z.string().describe("ID of the customer making the booking"),
    shipTo_ID: z.string().describe("Shipping address ID for the booking"),
    bookingType: z.string().describe("ID of the booking type"),
    requestedDeliveryDate: z.string().describe("Requested delivery date in ISO format (YYYY-MM-DD)"),
    bookingItems: z.array(z.object({
      material_Product: z.string().describe("ID of the material"),
      quantity: z.number().describe("Quantity of the material")
    })).describe("List of booking items with material ID and quantity"),
    isActiveEntity: z.boolean().describe("Whether the booking is active or in draft state")
  }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Update Booking tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
export const updateBooking = tool({
  description: "update an existing booking in the on-premise booking system",
  parameters: z.object({ 
    bookingId: z.string().describe("ID of the booking to update"),
    soldTo_ID: z.string().optional().describe("Updated ID of the customer making the booking"),
    shipTo_ID: z.string().optional().describe("Updated shipping address ID for the booking"),
    bookingType: z.string().optional().describe("Updated ID of the booking type"),
    requestedDeliveryDate: z.string().optional().describe("Updated requested delivery date in ISO format (YYYY-MM-DD)"),
    bookingItems: z.array(z.object({
      material_Product: z.string().describe("ID of the material"),
      quantity: z.number().describe("Quantity of the material")
    })).optional().describe("Updated list of booking items with material ID and quantity"),
    isActiveEntity: z.boolean().optional().describe("Whether the booking is active or in draft state")
  }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Implementation of confirmation-required booking tools for on-premise API
 */
export const onPremiseBookingExecutions = {
  createBooking: async ({ 
    soldTo_ID,
    shipTo_ID,
    bookingType,
    requestedDeliveryDate,
    bookingItems,
    isActiveEntity
  }: { 
    soldTo_ID: string,
    shipTo_ID: string,
    bookingType: string,
    requestedDeliveryDate: string,
    bookingItems: any[],
    isActiveEntity: boolean
  }) => {
    console.log(`Creating on-premise booking for customer ID: ${soldTo_ID}, ship to ID: ${shipTo_ID}, type: ${bookingType}, delivery date: ${requestedDeliveryDate}`);
    
    try {
      // Construct the booking data
      const bookingData = {
        soldTo_ID,
        shipTo_ID,
        type_code: bookingType,
        requestedDelivery: requestedDeliveryDate,
        IsActiveEntity: isActiveEntity,
        items: bookingItems
      };
      
      // Use fetchApi for the API call with the full path
      const newBooking = await fetchApi(
        ON_PREMISE_API_PATH,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        },
        'onpremise'
      ) as { id?: string, [key: string]: any };
      
      return {
        success: true,
        message: `On-premise booking successfully created for customer ID: ${soldTo_ID}`,
        bookingId: newBooking.id || "Unknown",
        details: newBooking
      };
    } catch (error) {
      console.error(`Error creating on-premise booking: ${error}`);
      return {
        success: false,
        message: `Failed to create on-premise booking: ${error}`
      };
    }
  },

  updateBooking: async ({
    bookingId,
    soldTo_ID,
    shipTo_ID,
    bookingType,
    requestedDeliveryDate,
    bookingItems,
    isActiveEntity = true
  }: {
    bookingId: string,
    soldTo_ID?: string,
    shipTo_ID?: string,
    bookingType?: string,
    requestedDeliveryDate?: string,
    bookingItems?: any[],
    isActiveEntity?: boolean
  }) => {
    console.log(`Updating on-premise booking ID: ${bookingId}, isActiveEntity: ${isActiveEntity}`);
    
    try {
      // First, get the current booking to update only changed fields
      const currentBooking = await fetchApi(
        `${ON_PREMISE_API_PATH}(ID=${bookingId},IsActiveEntity=${isActiveEntity})`,
        {},
        'onpremise'
      );
      
      // Construct the booking update data with only changed fields
      const updateData: any = {};
      
      if (soldTo_ID) updateData.soldTo_ID = soldTo_ID;
      if (shipTo_ID) updateData.shipTo_ID = shipTo_ID;
      if (bookingType) updateData.type_code = bookingType;
      if (requestedDeliveryDate) updateData.requestedDelivery = requestedDeliveryDate;
      if (bookingItems) updateData.items = bookingItems;
      if (isActiveEntity !== undefined) updateData.IsActiveEntity = isActiveEntity;
      
      // Use fetchApi for the API call with the full path
      await fetchApi(
        `${ON_PREMISE_API_PATH}(ID=${bookingId},IsActiveEntity=${isActiveEntity})`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        },
        'onpremise'
      );
      
      return {
        success: true,
        message: `On-premise booking ${bookingId} successfully updated`,
        bookingId: bookingId
      };
    } catch (error) {
      console.error(`Error updating on-premise booking: ${error}`);
      return {
        success: false,
        message: `Failed to update on-premise booking: ${error}`
      };
    }
  },
}; 