-- Create support tickets table
CREATE TABLE public.support_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- open, closed, pending
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table
CREATE TABLE public.support_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL, -- auth.uid()
    sender_role TEXT NOT NULL, -- 'store' or 'admin'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

-- Policies for tickets
CREATE POLICY "Stores can view their own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id));

CREATE POLICY "Stores can create their own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id));

CREATE POLICY "Admins can view all tickets" ON public.support_tickets
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL));

CREATE POLICY "Admins can update all tickets" ON public.support_tickets
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL));

-- Policies for messages
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL))
        )
    );

CREATE POLICY "Users can insert messages for their tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL))
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();