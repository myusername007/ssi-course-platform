// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./interfaces/IIdentityRegistry.sol";

/// @notice Ticket sales for events, restricted to wallets that hold a
/// registered identity in the existing BasicIdentityRegistry. Like
/// CourseRegistry, this contract only ever READS that registry through
/// IIdentityRegistry.getIdentity() and never writes to it.
///
/// Design choices:
///  - A ticket is a record "ticketId -> owner", not a token: there is no
///    transfer function, so tickets are bound to the identity that bought
///    them (no resale).
///  - "Available" is not stored: a seat is free while sold < capacity.
///  - Payment must equal the price exactly and is never refunded, so the
///    contract makes no external call with value during a purchase.
///  - One ticket per address per event.
///  - Attendance is self-reported: the ticket holder calls checkIn() during
///    the event window, which marks the ticket used. The organizer cannot
///    mark tickets, so nobody needs to be at a door; only a holder who
///    checked in can rate the event.
contract TicketRegistry {
    /// @notice How long before an event starts its holders may check in.
    uint64 public constant CHECK_IN_OPENS_BEFORE = 15 minutes;

    IIdentityRegistry public immutable identityRegistry;
    /// @notice The organizer: creates events and withdraws funds.
    address public immutable owner;

    struct EventInfo {
        uint256 price;
        uint32 capacity;
        uint32 sold;
        uint64 startsAt;
        uint64 endsAt;
        bool exists;
    }

    struct Ticket {
        address owner;
        bool used;
        uint256 eventId;
    }

    mapping(uint256 => EventInfo) private _events;

    /// @dev ticket ids start at 1, so 0 can mean "none"
    uint256 private _lastTicketId;
    mapping(uint256 => Ticket) private _tickets;
    /// buyer => eventId => ticketId (0 = no ticket)
    mapping(address => mapping(uint256 => uint256)) private _ticketOf;

    mapping(uint256 => uint64) private _ratingSum;
    mapping(uint256 => uint32) private _ratingCount;
    /// eventId => rater => score (0 = not rated)
    mapping(uint256 => mapping(address => uint8)) private _ratingOf;

    event EventCreated(uint256 indexed eventId, uint256 price, uint32 capacity, uint64 startsAt, uint64 endsAt);
    event TicketPurchased(uint256 indexed ticketId, uint256 indexed eventId, address indexed buyer, uint256 price);
    event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId);
    event EventRated(uint256 indexed eventId, address indexed rater, uint8 score);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error NotVerified();
    error EventNotFound();
    error EventAlreadyExists();
    error InvalidEventParams();
    error SaleClosed();
    error SoldOut();
    error AlreadyHasTicket();
    error WrongPayment();
    error TicketNotFound();
    error AlreadyUsed();
    error NotTicketHolder();
    error CheckInNotOpen();
    error EventEnded();
    error NoTicket();
    error EventNotFinished();
    error NotAttended();
    error AlreadyRated();
    error InvalidScore();
    error WithdrawFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address identityRegistryAddress) {
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
        owner = msg.sender;
    }

    // ---------------------------------------------------------------
    // Verification (read-only view of the existing identity registry)
    // ---------------------------------------------------------------

    /// @notice True if `user` has a registered identity (non-zero timestamp).
    function isVerified(address user) public view returns (bool) {
        (, , , uint256 timestamp) = identityRegistry.getIdentity(user);
        return timestamp != 0;
    }

    // ---------------------------------------------------------------
    // Organizer
    // ---------------------------------------------------------------

    /// @notice Creates an event under a caller-chosen id (so the id matches
    /// the off-chain database row). `startsAt` closes the sale, `endsAt`
    /// opens ratings.
    function createEvent(
        uint256 eventId,
        uint256 price,
        uint32 capacity,
        uint64 startsAt,
        uint64 endsAt
    ) external onlyOwner {
        if (_events[eventId].exists) revert EventAlreadyExists();
        if (capacity == 0 || startsAt <= block.timestamp || endsAt <= startsAt) {
            revert InvalidEventParams();
        }

        _events[eventId] = EventInfo({
            price: price,
            capacity: capacity,
            sold: 0,
            startsAt: startsAt,
            endsAt: endsAt,
            exists: true
        });
        emit EventCreated(eventId, price, capacity, startsAt, endsAt);
    }

    /// @notice Sends all collected payments to the organizer.
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, amount);
    }

    // ---------------------------------------------------------------
    // Buyers
    // ---------------------------------------------------------------

    /// @notice Buys one ticket for `eventId`. Requires a verified identity,
    /// no existing ticket for this event, a free seat, an open sale and
    /// exact payment.
    function buyTicket(uint256 eventId) external payable returns (uint256 ticketId) {
        EventInfo storage e = _events[eventId];
        if (!e.exists) revert EventNotFound();
        if (block.timestamp >= e.startsAt) revert SaleClosed();
        if (e.sold >= e.capacity) revert SoldOut();
        if (msg.value != e.price) revert WrongPayment();
        if (_ticketOf[msg.sender][eventId] != 0) revert AlreadyHasTicket();
        if (!isVerified(msg.sender)) revert NotVerified();

        e.sold += 1;
        ticketId = ++_lastTicketId;
        _tickets[ticketId] = Ticket({owner: msg.sender, used: false, eventId: eventId});
        _ticketOf[msg.sender][eventId] = ticketId;

        emit TicketPurchased(ticketId, eventId, msg.sender, msg.value);
    }

    /// @notice The holder joins the event: marks their own ticket used. Open
    /// from CHECK_IN_OPENS_BEFORE before the start until the event ends; works
    /// once per ticket.
    function checkIn(uint256 ticketId) external {
        Ticket storage t = _tickets[ticketId];
        if (t.owner == address(0)) revert TicketNotFound();
        if (t.owner != msg.sender) revert NotTicketHolder();
        if (t.used) revert AlreadyUsed();

        EventInfo storage e = _events[t.eventId];
        if (block.timestamp + CHECK_IN_OPENS_BEFORE < e.startsAt) revert CheckInNotOpen();
        if (block.timestamp >= e.endsAt) revert EventEnded();

        t.used = true;
        emit TicketUsed(ticketId, t.eventId);
    }

    /// @notice Rates an event 1..5. Only a holder who checked in may rate,
    /// only after the event ended, and only once.
    function rateEvent(uint256 eventId, uint8 score) external {
        EventInfo storage e = _events[eventId];
        if (!e.exists) revert EventNotFound();
        if (block.timestamp < e.endsAt) revert EventNotFinished();
        if (score < 1 || score > 5) revert InvalidScore();

        uint256 ticketId = _ticketOf[msg.sender][eventId];
        if (ticketId == 0) revert NoTicket();
        if (!_tickets[ticketId].used) revert NotAttended();
        if (_ratingOf[eventId][msg.sender] != 0) revert AlreadyRated();

        _ratingOf[eventId][msg.sender] = score;
        _ratingSum[eventId] += score;
        _ratingCount[eventId] += 1;
        emit EventRated(eventId, msg.sender, score);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function eventInfo(uint256 eventId)
        external
        view
        returns (uint256 price, uint32 capacity, uint32 sold, uint64 startsAt, uint64 endsAt, bool exists)
    {
        EventInfo storage e = _events[eventId];
        return (e.price, e.capacity, e.sold, e.startsAt, e.endsAt, e.exists);
    }

    function ticketInfo(uint256 ticketId)
        external
        view
        returns (address ticketOwner, uint256 eventId, bool used)
    {
        Ticket storage t = _tickets[ticketId];
        if (t.owner == address(0)) revert TicketNotFound();
        return (t.owner, t.eventId, t.used);
    }

    /// @notice The ticket id `user` holds for `eventId`, or 0 if none.
    function ticketOf(address user, uint256 eventId) external view returns (uint256) {
        return _ticketOf[user][eventId];
    }

    /// @notice Sum and count of ratings; the average is sum / count off-chain.
    function getRating(uint256 eventId) external view returns (uint64 sum, uint32 count) {
        return (_ratingSum[eventId], _ratingCount[eventId]);
    }

    /// @notice The score `user` gave to `eventId` (0 = not rated).
    function ratingOf(uint256 eventId, address user) external view returns (uint8) {
        return _ratingOf[eventId][user];
    }

    /// @notice Total tickets sold across all events.
    function totalTickets() external view returns (uint256) {
        return _lastTicketId;
    }
}
