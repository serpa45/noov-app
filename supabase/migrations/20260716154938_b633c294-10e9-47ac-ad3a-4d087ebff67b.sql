
CREATE POLICY "Stores can update their own tickets"
ON public.support_tickets
FOR UPDATE
USING (auth.uid() IN (SELECT lojas.user_id FROM lojas WHERE lojas.id = support_tickets.store_id))
WITH CHECK (auth.uid() IN (SELECT lojas.user_id FROM lojas WHERE lojas.id = support_tickets.store_id));
