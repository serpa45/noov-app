-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON public.support_messages;

-- Re-create policies for tickets with corrected admin check
CREATE POLICY "Admins can view all tickets" ON public.support_tickets
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update all tickets" ON public.support_tickets
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Re-create policies for messages with corrected admin check
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
        )
    );

CREATE POLICY "Users can insert messages for their tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
        )
    );