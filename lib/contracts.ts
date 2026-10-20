// Frontend-side contract constants. Deployed once (contracts/scripts/deploy.ts,
// see DESCRIPTION.md Stage 5а), never redeployed — this address is fixed.
export const COURSE_REGISTRY_ADDRESS = "0x3fD6670b1e25A0D35968ba0eB06A08856a16b11B";
export const IDENTITY_REGISTRY_ADDRESS = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";

export const COURSE_REGISTRY_ABI = [
  "function isVerified(address user) public view returns (bool)",
  "function registerForCourse(uint256 courseId) external",
  "function getCourseRegistration(address user, uint256 courseId) external view returns (uint256)",
  "event CourseRegistered(address indexed user, uint256 indexed courseId, uint256 timestamp)",
];

// TicketRegistry (contracts/contracts/TicketRegistry.sol), deployed once to
// Sepolia by contracts/scripts/deploy-tickets.ts. Same address as
// contracts/deployments.json.
export const TICKET_REGISTRY_ADDRESS = "0x14F749672AB73F16EAaEffAAc91c864B3Acc4852";

export const TICKET_REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function isVerified(address user) view returns (bool)",
  "function buyTicket(uint256 eventId) payable returns (uint256 ticketId)",
  "function markUsed(uint256 ticketId)",
  "function rateEvent(uint256 eventId, uint8 score)",
  "function eventInfo(uint256 eventId) view returns (uint256 price, uint32 capacity, uint32 sold, uint64 startsAt, uint64 endsAt, bool exists)",
  "function ticketInfo(uint256 ticketId) view returns (address ticketOwner, uint256 eventId, bool used)",
  "function ticketOf(address user, uint256 eventId) view returns (uint256)",
  "function getRating(uint256 eventId) view returns (uint64 sum, uint32 count)",
  "function ratingOf(uint256 eventId, address user) view returns (uint8)",
  "event TicketPurchased(uint256 indexed ticketId, uint256 indexed eventId, address indexed buyer, uint256 price)",
  "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId)",
  "event EventRated(uint256 indexed eventId, address indexed rater, uint8 score)",
  "error NotOwner()",
  "error NotVerified()",
  "error EventNotFound()",
  "error EventAlreadyExists()",
  "error InvalidEventParams()",
  "error SaleClosed()",
  "error SoldOut()",
  "error AlreadyHasTicket()",
  "error WrongPayment()",
  "error TicketNotFound()",
  "error AlreadyUsed()",
  "error NoTicket()",
  "error EventNotFinished()",
  "error NotAttended()",
  "error AlreadyRated()",
  "error InvalidScore()",
  "error WithdrawFailed()",
];
