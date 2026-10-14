# Private organization conversations

The existing messaging implementation lets every member of a solution provider read its conversations. The client now requires an organization conversation to be visible to its owners and to members whom an owner explicitly adds to that conversation. This applies to both the organization that starts a solution conversation and the organization that receives it. Personal talent conversations keep their existing audience. Program conversations are readable only by their sender and one assigned operator; system administrators manage the assignment without reading the messages.

## Design

- A solution conversation has two organization sides. Current owners of either organization can read and write for their side. A member can do so only while they remain in that organization and have a participant row for this conversation and side. The initial sender is not an implicit exception. Only an owner starts a new solution conversation.
- A solution conversation is looked up by starter organization and solution. Starts by different owners of the same organization are serialized and continue the same active conversation.
- An owner can add or remove a current member of their own organization. The member list and invitation action are shown within the conversation. An owner cannot add someone from the other organization. Removed members immediately lose list, detail, send, read and event access.
- A participant row belongs to the conversation and organization, with a foreign key to the organization membership. Organization merge updates the membership key and cascades the participant's organization; membership removal deletes the grant. Existing conversations start with no invited members, so owners are the only organization readers on deployment.
- The same authorization predicate governs list, unread totals and direct conversation access. The event audience is resolved from current owners and invited current members, rather than every organization member. Email recipients follow the same audience.
- Program conversations are open for the sender immediately, but have no operator reader until an administrator assigns an active operator. The administration queue shows only conversation identifier, program name, creation time and assignee identifier. It never includes sender information or message content. Existing program chats become unassigned at migration. Reassignment immediately removes the previous operator from direct access and event delivery; assignment changes are audited.
- Talent conversations remain between their two accounts. Reported first messages remain available to operators in the separate moderation view.
- The assignment queue holds up to 100 conversations, unassigned first. Owners and invited organization members may read the conversation history. Each organization controls grants only for its own side.

## Verification

- Integration tests exercise an uninvited member's refusal and the owner's ability to add and remove a member on both sides, including list, direct reads and writes.
- The backend and web gates must pass, including OpenAPI and generated client drift.
