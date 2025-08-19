/**
 * Tool definitions for the mymediset chat
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import { agentContext } from "./server";
import {
  unstable_getSchedulePrompt,
  unstable_scheduleSchema,
} from "agents/schedule";

// Import booking tools from the dedicated file
import { 
  getBookingInformation, 
  getAllBookings, 
  createBooking,
  bookingExecutions,
  getBookingTypes,
  getCustomers,
  getShipToAddresses,
  getMaterials,
  updateBooking,
} from "./tools/bookingTools";

// Import user info tools from the dedicated file
import {
  getUserLoginStatus,
  getUserInfo,
} from "./tools/userInfoTools";

// Import consumption tools from the dedicated file
import {
  getConsumptionRequest,
  getConsumptionRequests,
  getConsumptionRequestsByStatus,
  getConsumptionRequestsByCustomer,
  searchConsumptionRequestsByCaseRef,
  getConsumptionRequestStatusCodes,
} from "./tools/consumptionTools";

// Import jira tools from the dedicated file

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    try {
      const tasks = agent.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    try {
      await agent.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getLocalTime,
  getBookingInformation,
  getAllBookings,
  createBooking,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  getBookingTypes,
  getCustomers,
  getShipToAddresses,
  getMaterials,
  updateBooking,
  getUserLoginStatus,
  getUserInfo,
  // Add consumption tools
  getConsumptionRequest,
  getConsumptionRequests,
  getConsumptionRequestsByStatus,
  getConsumptionRequestsByCustomer,
  searchConsumptionRequestsByCaseRef,
  getConsumptionRequestStatusCodes,
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  // Include booking executions from booking tools file
  ...bookingExecutions,
};
