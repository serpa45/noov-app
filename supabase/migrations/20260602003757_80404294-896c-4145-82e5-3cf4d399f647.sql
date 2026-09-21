-- Adicionar política de exclusão para tickets de suporte (admins)
CREATE POLICY "Admins can delete tickets" 
ON public.support_tickets 
FOR DELETE 
USING (
  (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.codigo_admin IS NOT NULL)) OR 
  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);

-- Adicionar política de exclusão para mensagens de suporte (admins)
CREATE POLICY "Admins can delete support messages" 
ON public.support_messages 
FOR DELETE 
USING (
  (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.codigo_admin IS NOT NULL)) OR 
  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);