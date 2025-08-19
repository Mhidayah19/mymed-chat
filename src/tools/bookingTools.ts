/**
 * Booking-related tools for the mymediset chat
 */
import { tool } from "ai";
import { z } from "zod";
import { fetchApi, fetchApiWithParams, getApiConfig } from "../utils/apiUtils";

/**
 * Booking information tool that executes automatically
 * No human confirmation required
 */
export const getBookingInformation = tool({
  description: "retrieve booking information from the booking API",
  parameters: z.object({ 
    bookingId: z.string().describe("The ID of the booking to retrieve"),
    isActiveEntity: z.boolean().describe("Whether the booking is active or in draft state")
  }),
  execute: async ({ bookingId, isActiveEntity }) => {
    console.log(`Fetching booking information for booking ID: ${bookingId}, isActiveEntity: ${isActiveEntity}`);
    
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('$expand', '*');
      
      // Use fetchApiWithParams for the API call
      const bookingInfo = await fetchApi(
        `catalog/BookingService/Bookings(ID=${bookingId},IsActiveEntity=${isActiveEntity})?${queryParams.toString()}`
      );
      
      return bookingInfo;
    } catch (error) {
      console.error(`Error fetching booking information: ${error}`);
      return `Failed to retrieve booking information for ID ${bookingId}: ${error}`;
    }
  },
});

/**
 * Tool to get all bookings from the API
 * No human confirmation required
 */
export const getAllBookings = tool({
  description: "retrieve all bookings from the booking API",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of bookings to retrieve"),
    offset: z.number().optional().describe("Number of bookings to skip for pagination"),
    status: z.string().optional().describe("Filter bookings by status (e.g., 'confirmed', 'cancelled', 'pending')")
  }),
  execute: async ({ limit = 10, offset = 0, status = '' }) => {
    console.log(`Fetching all bookings with limit: ${limit}, offset: ${offset}, status: ${status}`);
    
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
      
      // Use fetchApiWithParams for the API call
      const bookings = await fetchApiWithParams('catalog/BookingService/Bookings', params);
      
      return bookings;
    } catch (error) {
      console.error(`Error fetching all bookings: ${error}`);
      return `Failed to retrieve bookings: ${error}`;
    }
  },
});

/**
 * Tool to get all booking types from the API
 * No human confirmation required
 */
export const getBookingTypes = tool({
  description: "Retrieve all booking types and their descriptions, helpful for the user to select the correct booking type",
  parameters: z.object({}),
  execute: async () => {
    console.log(`Fetching all booking types`);
    
    try {
      // Use fetchApi for the API call
      const bookingTypes = await fetchApi('catalog/BookingService/BookingTypes');
      
      return bookingTypes;
    } catch (error) {
      console.error(`Error fetching booking types: ${error}`);
      return `Failed to retrieve booking types: ${error}`;
    }
  },
});

/**
 * Tool to get all customers (soldTo) from the API
 * No human confirmation required
 */
export const getCustomers = tool({
  description: "Retrieve a list of customers (soldTo) that can make bookings",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of customers to retrieve"),
    offset: z.number().optional().describe("Number of customers to skip for pagination"),
    search: z.string().optional().describe("Search term to filter customers by name or ID")
  }),
  execute: async ({ limit = 10, offset = 0, search = '' }) => {
    console.log(`Fetching customers with limit: ${limit}, offset: ${offset}, search: ${search}`);
    
    try {
      // Build query parameters
      const params: Record<string, string | number | undefined> = {
        '$top': limit,
        '$skip': offset
      };
      
      if (search) {
        params['$search'] = search;
      }
      
      // Use fetchApiWithParams for the API call
      const customers = await fetchApiWithParams('catalog/BookingService/Customers', params);
      
      return customers;
    } catch (error) {
      console.error(`Error fetching customers: ${error}`);
      return `Failed to retrieve customers: ${error}`;
    }
  },
});

/**
 * Tool to get all shipping addresses (shipTo) from the API
 * No human confirmation required
 */
export const getShipToAddresses = tool({
  description: "Retrieve a list of shipping addresses (shipTo) that can be used for bookings",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of shipping addresses to retrieve"),
    offset: z.number().optional().describe("Number of shipping addresses to skip for pagination"),
    search: z.string().optional().describe("Search term to filter shipping addresses by name, ID or location"),
    // customerId: z.string().optional().describe("Filter shipping addresses by customer ID (soldTo)")
  }),
  execute: async ({ limit = 10, offset = 0, search = '' }) => {
    console.log(`Fetching shipping addresses with limit: ${limit}, offset: ${offset}, search: ${search}`);
    
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
      // if (customerId) {
      //   params['$filter'] = `soldTo_ID eq '${customerId}'`;
      // }
      
      // Use fetchApiWithParams for the API call
      const shipToAddresses = await fetchApiWithParams('catalog/BookingService/BusinessPartners', params);
      
      return shipToAddresses;
    } catch (error) {
      console.error(`Error fetching shipping addresses: ${error}`);
      return `Failed to retrieve shipping addresses: ${error}`;
    }
  },
});

/**
 * Tool to get all materials from the API
 * No human confirmation required
 */
export const getMaterials = tool({
  description: "Retrieve a list of available materials that can be added to bookings",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of materials to retrieve"),
    offset: z.number().optional().describe("Number of materials to skip for pagination"),
    search: z.string().optional().describe("Search term to filter materials by name, ID, or description"),
    category: z.string().optional().describe("Filter materials by category")
  }),
  execute: async ({ limit = 10, offset = 0, search = '', category = '' }) => {
    console.log(`Fetching materials with limit: ${limit}, offset: ${offset}, search: ${search}, category: ${category}`);
    
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
      
      // Use fetchApiWithParams for the API call
      const materials = await fetchApiWithParams('catalog/BookingService/Materials', params);
      
      return materials;
    } catch (error) {
      console.error(`Error fetching materials: ${error}`);
      return `Failed to retrieve materials: ${error}`;
    }
  },
});

/**
 * Create Booking tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
export const createBooking = tool({
  description: "create a new booking in the booking system",
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
  description: "update an existing booking in the booking system",
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
 * Implementation of confirmation-required booking tools
 */
export const bookingExecutions = {
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
    console.log(`Creating booking for customer ID: ${soldTo_ID}, ship to ID: ${shipTo_ID}, type: ${bookingType}, delivery date: ${requestedDeliveryDate}`);
    
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
      
      // Use fetchApi for the API call
      const newBooking = await fetchApi('catalog/BookingService/Bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      }) as { id?: string, [key: string]: any };
      
      return {
        success: true,
        message: `Booking successfully created for customer ID: ${soldTo_ID}`,
        bookingId: newBooking.id || "Unknown",
        details: newBooking
      };
    } catch (error) {
      console.error(`Error creating booking: ${error}`);
      return {
        success: false,
        message: `Failed to create booking: ${error}`
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
    console.log(`Updating booking ID: ${bookingId}, isActiveEntity: ${isActiveEntity}`);
    
    try {
      // First, get the current booking to update only changed fields
      const currentBooking = await fetchApi(`catalog/BookingService/Bookings(ID=${bookingId},IsActiveEntity=${isActiveEntity})`);
      
      // Construct the booking update data with only changed fields
      const updateData: any = {};
      
      if (soldTo_ID) updateData.soldTo_ID = soldTo_ID;
      if (shipTo_ID) updateData.shipTo_ID = shipTo_ID;
      if (bookingType) updateData.type_code = bookingType;
      if (requestedDeliveryDate) updateData.requestedDelivery = requestedDeliveryDate;
      if (bookingItems) updateData.items = bookingItems;
      if (isActiveEntity !== undefined) updateData.IsActiveEntity = isActiveEntity;
      
      // Use fetchApi for the API call
      await fetchApi(`catalog/BookingService/Bookings(ID=${bookingId},IsActiveEntity=${isActiveEntity})`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      return {
        success: true,
        message: `Booking ${bookingId} successfully updated`,
        bookingId: bookingId
      };
    } catch (error) {
      console.error(`Error updating booking: ${error}`);
      return {
        success: false,
        message: `Failed to update booking: ${error}`
      };
    }
  },
}; 