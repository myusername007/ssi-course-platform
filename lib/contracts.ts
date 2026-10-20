// Contract addresses and ABIs used by the app. The identity registry is the
// existing contract from the SSI dApp; only ever read.
export const IDENTITY_REGISTRY_ADDRESS = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";

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
