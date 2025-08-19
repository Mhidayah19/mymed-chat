/**
 * Consumption-related tools for the mymediset chat
 */
import { tool } from "ai";
import { z } from "zod";
import { fetchApi, fetchApiWithParams } from "../utils/apiUtils";

/**
 * Tool to get a single consumption request by ID
 * No human confirmation required
 */
export const getConsumptionRequest = tool({
  description: "Retrieve detailed information about a specific consumption request",
  parameters: z.object({
    id: z.string().describe("The ID of the consumption request to retrieve"),
    expand: z.array(z.string()).optional().describe("Optional associations to expand in the response")
  }),
  execute: async ({ id, expand = [] }) => {
    console.log(`Fetching consumption request with ID: ${id}`);
    
    try {
      // Build URL directly with proper encoding
      let url = `catalog/ConsumptionService/ConsumptionRequests(ID=${encodeURIComponent(id)})`;
      
      // Add expand parameter if provided
      if (expand.length > 0) {
        url += `?$expand=${encodeURIComponent(expand.join(','))}`;
      }
      
      // Use fetchApi for the API call
      const consumptionRequest = await fetchApi(url);
      
      return consumptionRequest;
    } catch (error) {
      console.error(`Error fetching consumption request: ${error}`);
      return `Failed to retrieve consumption request for ID ${id}: ${error}`;
    }
  },
});

/**
 * Tool to get multiple consumption requests with optional filtering
 * No human confirmation required
 */
export const getConsumptionRequests = tool({
  description: "Retrieve multiple consumption requests with optional filtering and pagination",
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of requests to retrieve"),
    skip: z.number().optional().describe("Number of requests to skip for pagination"),
    orderBy: z.union([z.string(), z.array(z.string())]).optional().describe("Field(s) to order results by example: 'createdAt' (not 'createdDate')"),
    filter: z.record(z.any()).optional().describe("Filter criteria for the requests"),
    expand: z.array(z.string()).optional().describe("Associations to expand in the response"),
    createdBy: z.string().optional().describe("Filter by the user who created the request")
  }),
  execute: async ({ limit = 10, skip = 0, orderBy = [], filter = {}, expand = [], createdBy = null }) => {
    console.log(`Fetching consumption requests with limit: ${limit}, skip: ${skip}`);
    
    try {
      // Build URL directly with proper encoding
      let url = `catalog/ConsumptionService/ConsumptionRequests?$top=${limit}&$skip=${skip}`;
      
      // Add expand parameter if provided
      if (expand.length > 0) {
        url += `&$expand=${encodeURIComponent(expand.join(','))}`;
      }
      
      // Add orderBy parameter if provided
      if (orderBy) {
        // Replace any instances of 'createdDate' with 'createdAt'
        const correctOrderBy = Array.isArray(orderBy) 
          ? orderBy.map(field => field.replace('createdDate', 'createdAt'))
          : orderBy.replace('createdDate', 'createdAt');
        
        if (Array.isArray(correctOrderBy)) {
          url += `&$orderby=${encodeURIComponent(correctOrderBy.join(','))}`;
        } else {
          url += `&$orderby=${encodeURIComponent(correctOrderBy)}`;
        }
      }
      
      // Add filter parameter if provided
      if (Object.keys(filter).length > 0) {
        let filterString = Object.entries(filter)
          .map(([key, value]) => {
            // Replace any instances of 'createdDate' with 'createdAt' in keys
            const correctedKey = key.replace('createdDate', 'createdAt');
            
            if (typeof value === 'object' && value !== null) {
              // Handle contains operator
              if ('contains' in value) {
                return `contains(${correctedKey}, '${value.contains}')`;
              }
            }
            // Don't use quotes for status codes
            if (correctedKey === 'status_code' || correctedKey === 'customer_ID') {
              return `${correctedKey} eq ${value}`;
            }
            return `${correctedKey} eq '${value}'`;
          })
          .join(' and ');

        if (createdBy) {
          filterString += ` and createdBy eq ${createdBy}`;
        }
        
        url += `&$filter=${encodeURIComponent(filterString)}`;
      } else if (createdBy) {
        // If there are no other filters but createdBy is specified
        url += `&$filter=${encodeURIComponent(`createdBy eq ${createdBy}`)}`;
      }
      
      // Use fetchApi for the API call
      const consumptionRequests = await fetchApi(url);
      
      return consumptionRequests;
    } catch (error) {
      console.error(`Error fetching consumption requests: ${error}`);
      return `Failed to retrieve consumption requests: ${error}`;
    }
  },
});

/**
 * Tool to get consumption requests filtered by status
 * No human confirmation required
 */
export const getConsumptionRequestsByStatus = tool({
  description: "Retrieve consumption request filtered by status code",
  parameters: z.object({
    statusCode: z.string().describe("Status code to filter by (e.g., 'O', 'P', 'W', 'R', 'T', 'I', 'E')"),
    limit: z.number().optional().describe("Maximum number of requests to retrieve"),
    skip: z.number().optional().describe("Number of requests to skip for pagination"),
    expand: z.array(z.string()).optional().describe("Associations to expand in the response")
  }),
  execute: async ({ statusCode, limit = 10, skip = 0, expand = [] }) => {
    console.log(`Fetching consumption requests by status: ${statusCode}`);
    
    try {
      // Instead of URLSearchParams, build the URL manually with proper encoding
      let url = `catalog/ConsumptionService/ConsumptionRequests?$top=${limit}&$skip=${skip}`;
      
      // Add filter directly with proper encoding
      url += `&$filter=status_code eq ${encodeURIComponent(statusCode)}`;
      
      // Add expand parameter if provided
      if (expand.length > 0) {
        url += `&$expand=${encodeURIComponent(expand.join(','))}`;
      }
      
      // Use fetchApi for the API call
      const consumptionRequests = await fetchApi(url);
      
      return consumptionRequests;
    } catch (error) {
      console.error(`Error fetching consumption requests by status: ${error}`);
      return `Failed to retrieve consumption requests by status: ${error}`;
    }
  },
});

/**
 * Tool to get consumption requests for a specific customer
 * No human confirmation required
 */
export const getConsumptionRequestsByCustomer = tool({
  description: "Retrieve consumption requests for a specific customer",
  parameters: z.object({
    customerId: z.string().describe("Customer ID to filter by"),
    limit: z.number().optional().describe("Maximum number of requests to retrieve"),
    skip: z.number().optional().describe("Number of requests to skip for pagination"),
    expand: z.array(z.string()).optional().describe("Associations to expand in the response")
  }),
  execute: async ({ customerId, limit = 10, skip = 0, expand = [] }) => {
    console.log(`Fetching consumption requests for customer: ${customerId}`);
    
    try {
      // Instead of URLSearchParams, build the URL manually with proper encoding
      let url = `catalog/ConsumptionService/ConsumptionRequests?$top=${limit}&$skip=${skip}`;
      
      // Add filter directly with proper encoding
      url += `&$filter=customer_ID eq ${encodeURIComponent(customerId)}`;
      
      // Add expand parameter if provided
      if (expand.length > 0) {
        url += `&$expand=${encodeURIComponent(expand.join(','))}`;
      }
      
      // Use fetchApi for the API call
      const consumptionRequests = await fetchApi(url);
      
      return consumptionRequests;
    } catch (error) {
      console.error(`Error fetching consumption requests for customer: ${error}`);
      return `Failed to retrieve consumption requests for customer: ${error}`;
    }
  },
});

/**
 * Tool to search consumption requests by case reference number
 * No human confirmation required
 */
export const searchConsumptionRequestsByCaseRef = tool({
  description: "Search for consumption requests by case reference number",
  parameters: z.object({
    caseRef: z.string().describe("Case reference to search for"),
    limit: z.number().optional().describe("Maximum number of requests to retrieve"),
    skip: z.number().optional().describe("Number of requests to skip for pagination"),
    expand: z.array(z.string()).optional().describe("Associations to expand in the response")
  }),
  execute: async ({ caseRef, limit = 10, skip = 0, expand = [] }) => {
    console.log(`Searching consumption requests by case reference: ${caseRef}`);
    
    try {
      // Instead of URLSearchParams, build the URL manually with proper encoding
      let url = `catalog/ConsumptionService/ConsumptionRequests?$top=${limit}&$skip=${skip}`;
      
      // Add filter directly with proper encoding
      const filterExpr = `contains(caseRef, '${caseRef}')`;
      url += `&$filter=${encodeURIComponent(filterExpr)}`;
      
      // Add expand parameter if provided
      if (expand.length > 0) {
        url += `&$expand=${encodeURIComponent(expand.join(','))}`;
      }
      
      // Use fetchApi for the API call
      const consumptionRequests = await fetchApi(url);
      
      return consumptionRequests;
    } catch (error) {
      console.error(`Error searching consumption requests by case reference: ${error}`);
      return `Failed to search consumption requests by case reference: ${error}`;
    }
  },
});

/**
 * Tool to get consumption request status codes and descriptions
 * No human confirmation required
 */
export const getConsumptionRequestStatusCodes = tool({
  description: "Retrieve all available consumption request status codes and their descriptions",
  parameters: z.object({}),
  execute: async () => {
    console.log(`Fetching consumption request status codes`);
    
    try {
      // Use direct URL with no parameters
      const statusCodes = await fetchApi(`catalog/ConsumptionService/ConsumptionRequestStatus`);
      
      return statusCodes;
    } catch (error) {
      console.error(`Error fetching consumption request status codes: ${error}`);
      return `Failed to retrieve consumption request status codes: ${error}`;
    }
  },
});

// Export all consumption tools
export const consumptionTools = {
  getConsumptionRequest,
  getConsumptionRequests,
  getConsumptionRequestsByStatus,
  getConsumptionRequestsByCustomer,
  searchConsumptionRequestsByCaseRef,
  getConsumptionRequestStatusCodes
};