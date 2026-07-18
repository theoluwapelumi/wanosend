-- Ensure one message per (campaign, contact) so enqueue is idempotent/resumable.
CREATE UNIQUE INDEX "Message_campaignId_contactId_key" ON "Message"("campaignId", "contactId");
