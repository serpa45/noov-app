export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          label: string | null
          page: string | null
          path: string | null
          session_id: string
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          label?: string | null
          page?: string | null
          path?: string | null
          session_id: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          label?: string | null
          page?: string | null
          path?: string | null
          session_id?: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      admin_mensagens: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          loja_id: string | null
          titulo: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          titulo: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_mensagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_mensagens_excluidas: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          mensagem_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          mensagem_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          mensagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_mensagens_excluidas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_mensagens_excluidas_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "admin_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_mensagens_lidas: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          mensagem_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          mensagem_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          mensagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_mensagens_lidas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_mensagens_lidas_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "admin_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      app_version: {
        Row: {
          id: number
          major: number
          minor: number
          updated_at: string
        }
        Insert: {
          id?: number
          major?: number
          minor?: number
          updated_at?: string
        }
        Update: {
          id?: number
          major?: number
          minor?: number
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          aniversario_visto_ano: number | null
          created_at: string
          data_nascimento: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          foto_url: string | null
          id: string
          instagram: string | null
          loja_id: string | null
          nome_completo: string
          telefone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          aniversario_visto_ano?: number | null
          created_at?: string
          data_nascimento?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          foto_url?: string | null
          id?: string
          instagram?: string | null
          loja_id?: string | null
          nome_completo: string
          telefone: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          aniversario_visto_ano?: number | null
          created_at?: string
          data_nascimento?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          foto_url?: string | null
          id?: string
          instagram?: string | null
          loja_id?: string | null
          nome_completo?: string
          telefone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          afiliado_id: string
          created_at: string
          id: string
          loja_id: string
          pago_em: string | null
          pedido_id: string | null
          percentual: number
          status: string
          valor_comissao: number
          valor_pedido: number
        }
        Insert: {
          afiliado_id: string
          created_at?: string
          id?: string
          loja_id: string
          pago_em?: string | null
          pedido_id?: string | null
          percentual?: number
          status?: string
          valor_comissao?: number
          valor_pedido?: number
        }
        Update: {
          afiliado_id?: string
          created_at?: string
          id?: string
          loja_id?: string
          pago_em?: string | null
          pedido_id?: string | null
          percentual?: number
          status?: string
          valor_comissao?: number
          valor_pedido?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_globais: {
        Row: {
          chave: string
          created_at: string
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      cupom_clientes: {
        Row: {
          cliente_identificador: string
          cliente_nome: string | null
          created_at: string
          cupom_id: string
          id: string
        }
        Insert: {
          cliente_identificador: string
          cliente_nome?: string | null
          created_at?: string
          cupom_id: string
          id?: string
        }
        Update: {
          cliente_identificador?: string
          cliente_nome?: string | null
          created_at?: string
          cupom_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cupom_clientes_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          limite_por_cliente: number | null
          limite_total: number | null
          loja_id: string
          tipo: Database["public"]["Enums"]["app_cupom_tipo"]
          tipo_publico: boolean
          updated_at: string
          uso_unico: boolean | null
          usos_count: number
          validade_fim: string | null
          validade_inicio: string | null
          valor: number
          valor_minimo: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          limite_por_cliente?: number | null
          limite_total?: number | null
          loja_id: string
          tipo: Database["public"]["Enums"]["app_cupom_tipo"]
          tipo_publico?: boolean
          updated_at?: string
          uso_unico?: boolean | null
          usos_count?: number
          validade_fim?: string | null
          validade_inicio?: string | null
          valor?: number
          valor_minimo?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          limite_por_cliente?: number | null
          limite_total?: number | null
          loja_id?: string
          tipo?: Database["public"]["Enums"]["app_cupom_tipo"]
          tipo_publico?: boolean
          updated_at?: string
          uso_unico?: boolean | null
          usos_count?: number
          validade_fim?: string | null
          validade_inicio?: string | null
          valor?: number
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          loja_id: string
          observacoes: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          data?: string
          descricao: string
          id?: string
          loja_id: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          loja_id?: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      entregador_pagamentos: {
        Row: {
          created_at: string | null
          data_pagamento: string | null
          entregador_id: string
          id: string
          lojista_id: string
          periodo_fim: string
          periodo_inicio: string
          quantidade_entregas: number
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_pagamento?: string | null
          entregador_id: string
          id?: string
          lojista_id: string
          periodo_fim: string
          periodo_inicio: string
          quantidade_entregas: number
          valor: number
        }
        Update: {
          created_at?: string | null
          data_pagamento?: string | null
          entregador_id?: string
          id?: string
          lojista_id?: string
          periodo_fim?: string
          periodo_inicio?: string
          quantidade_entregas?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "entregador_pagamentos_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          aceita_em: string | null
          created_at: string
          endereco_coleta: string | null
          endereco_entrega: string | null
          entregador_id: string | null
          finalizada_em: string | null
          id: string
          latitude_atual: number | null
          lojista_id: string
          longitude_atual: number | null
          observacoes: string | null
          pago: boolean | null
          pedido_id: string | null
          status: string
          status_timestamps: Json
          updated_at: string
          valor_entrega: number
          valor_total: number | null
        }
        Insert: {
          aceita_em?: string | null
          created_at?: string
          endereco_coleta?: string | null
          endereco_entrega?: string | null
          entregador_id?: string | null
          finalizada_em?: string | null
          id?: string
          latitude_atual?: number | null
          lojista_id: string
          longitude_atual?: number | null
          observacoes?: string | null
          pago?: boolean | null
          pedido_id?: string | null
          status?: string
          status_timestamps?: Json
          updated_at?: string
          valor_entrega?: number
          valor_total?: number | null
        }
        Update: {
          aceita_em?: string | null
          created_at?: string
          endereco_coleta?: string | null
          endereco_entrega?: string | null
          entregador_id?: string | null
          finalizada_em?: string | null
          id?: string
          latitude_atual?: number | null
          lojista_id?: string
          longitude_atual?: number | null
          observacoes?: string | null
          pago?: boolean | null
          pedido_id?: string | null
          status?: string
          status_timestamps?: Json
          updated_at?: string
          valor_entrega?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          name: string
          stock_quantity: number
          store_id: string
          unit: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          name: string
          stock_quantity?: number
          store_id: string
          unit: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          name?: string
          stock_quantity?: number
          store_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_products: {
        Row: {
          created_at: string
          id: string
          linked_product_id: string
          loja_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_product_id: string
          loja_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_product_id?: string
          loja_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linked_products_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_products_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_adicionais: {
        Row: {
          created_at: string
          disponivel: boolean | null
          id: string
          loja_id: string
          nome: string
          preco: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disponivel?: boolean | null
          id?: string
          loja_id: string
          nome: string
          preco?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disponivel?: boolean | null
          id?: string
          loja_id?: string
          nome?: string
          preco?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_adicionais_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_categoria_imagens: {
        Row: {
          categoria: string
          created_at: string
          id: string
          imagem_url: string
          loja_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          imagem_url: string
          loja_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          imagem_url?: string
          loja_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_categoria_imagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_entregadores: {
        Row: {
          created_at: string
          entregador_id: string
          id: string
          loja_id: string
        }
        Insert: {
          created_at?: string
          entregador_id: string
          id?: string
          loja_id: string
        }
        Update: {
          created_at?: string
          entregador_id?: string
          id?: string
          loja_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_entregadores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_frete_bairros: {
        Row: {
          bairro: string
          created_at: string
          id: string
          loja_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          bairro: string
          created_at?: string
          id?: string
          loja_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          bairro?: string
          created_at?: string
          id?: string
          loja_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "loja_frete_bairros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_garcons: {
        Row: {
          created_at: string
          garcom_id: string
          id: string
          loja_id: string
        }
        Insert: {
          created_at?: string
          garcom_id: string
          id?: string
          loja_id: string
        }
        Update: {
          created_at?: string
          garcom_id?: string
          id?: string
          loja_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_garcons_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_plano_historico: {
        Row: {
          acao: string
          admin_id: string
          created_at: string
          dias_extras: number | null
          id: string
          loja_id: string
          observacao: string | null
          plano_id: string | null
          plano_nome: string | null
        }
        Insert: {
          acao: string
          admin_id: string
          created_at?: string
          dias_extras?: number | null
          id?: string
          loja_id: string
          observacao?: string | null
          plano_id?: string | null
          plano_nome?: string | null
        }
        Update: {
          acao?: string
          admin_id?: string
          created_at?: string
          dias_extras?: number | null
          id?: string
          loja_id?: string
          observacao?: string | null
          plano_id?: string | null
          plano_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loja_plano_historico_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_plano_historico_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_planos: {
        Row: {
          assinado_em: string
          ativo: boolean
          created_at: string
          expira_em: string | null
          features_assinado: Json
          id: string
          limites_assinado: Json
          loja_id: string
          plano_id: string
          preco_assinado: number
          promo_pagamentos_feitos: number | null
          updated_at: string
        }
        Insert: {
          assinado_em?: string
          ativo?: boolean
          created_at?: string
          expira_em?: string | null
          features_assinado?: Json
          id?: string
          limites_assinado?: Json
          loja_id: string
          plano_id: string
          preco_assinado: number
          promo_pagamentos_feitos?: number | null
          updated_at?: string
        }
        Update: {
          assinado_em?: string
          ativo?: boolean
          created_at?: string
          expira_em?: string | null
          features_assinado?: Json
          id?: string
          limites_assinado?: Json
          loja_id?: string
          plano_id?: string
          preco_assinado?: number
          promo_pagamentos_feitos?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_planos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_planos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          loja_id: string
          nivel: string
          nome: string
          permissoes: Json
          permissoes_acoes: Json | null
          pin: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id: string
          nivel: string
          nome: string
          permissoes?: Json
          permissoes_acoes?: Json | null
          pin: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id?: string
          nivel?: string
          nome?: string
          permissoes?: Json
          permissoes_acoes?: Json | null
          pin?: string
          updated_at?: string
        }
        Relationships: []
      }
      lojas: {
        Row: {
          afiliado_id: string | null
          ativo: boolean
          avaliacoes_ativas: boolean
          avaliacoes_produtos_ativas: boolean | null
          banner_url: string | null
          categorias_estilo: Json
          categorias_ocultas: Json | null
          categorias_ordem: Json | null
          codigo_convite: string
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string
          cupom_lembrete_ativo: boolean
          cupom_popup_ativo: boolean
          cupom_popup_cor_fundo: string
          cupom_popup_cor_texto: string
          cupom_popup_cta: string
          cupom_popup_imagem_url: string | null
          cupom_popup_subtitulo: string
          cupom_popup_titulo: string
          cupons_ativos: boolean | null
          dias_teste_extra: number
          documento: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          formas_pagamento: Json | null
          frete_bairros: Json | null
          frete_tipo: string | null
          frete_valor_fixo: number | null
          horario_funcionamento: Json | null
          id: string
          impressao_automatica: boolean
          impressao_automatica_qz: boolean | null
          impressao_duas_vias: boolean | null
          impressao_status_gatilho: string
          impressora_qz_nome: string | null
          instagram: string | null
          integration_fee_rate: number | null
          lembrete_aniversario: boolean
          logo_url: string | null
          mais_vendidos_ativo: boolean
          mapa_entrega_ativo: boolean
          margem_direita: number | null
          margem_esquerda: number | null
          margem_inferior: number | null
          margem_superior: number | null
          nome: string
          ocultar_evento: boolean
          pdv_venda_fora_horario: boolean
          plano_id_exclusivo: string | null
          popup_informativo_ativo: boolean
          popup_informativo_data_limite: string | null
          popup_informativo_imagem_url: string | null
          printer_steps: Json | null
          qz_certificate: string | null
          qz_program_url: string | null
          ranking_ativo: boolean | null
          segmento: string
          slug: string
          tempo_entrega_max: number | null
          tempo_entrega_min: number | null
          tolerancia_pedidos_min: number
          updated_at: string
          user_id: string
          valor_plano_exclusivo: number | null
          whatsapp: string | null
        }
        Insert: {
          afiliado_id?: string | null
          ativo?: boolean
          avaliacoes_ativas?: boolean
          avaliacoes_produtos_ativas?: boolean | null
          banner_url?: string | null
          categorias_estilo?: Json
          categorias_ocultas?: Json | null
          categorias_ordem?: Json | null
          codigo_convite?: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          cupom_lembrete_ativo?: boolean
          cupom_popup_ativo?: boolean
          cupom_popup_cor_fundo?: string
          cupom_popup_cor_texto?: string
          cupom_popup_cta?: string
          cupom_popup_imagem_url?: string | null
          cupom_popup_subtitulo?: string
          cupom_popup_titulo?: string
          cupons_ativos?: boolean | null
          dias_teste_extra?: number
          documento?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          formas_pagamento?: Json | null
          frete_bairros?: Json | null
          frete_tipo?: string | null
          frete_valor_fixo?: number | null
          horario_funcionamento?: Json | null
          id?: string
          impressao_automatica?: boolean
          impressao_automatica_qz?: boolean | null
          impressao_duas_vias?: boolean | null
          impressao_status_gatilho?: string
          impressora_qz_nome?: string | null
          instagram?: string | null
          integration_fee_rate?: number | null
          lembrete_aniversario?: boolean
          logo_url?: string | null
          mais_vendidos_ativo?: boolean
          mapa_entrega_ativo?: boolean
          margem_direita?: number | null
          margem_esquerda?: number | null
          margem_inferior?: number | null
          margem_superior?: number | null
          nome: string
          ocultar_evento?: boolean
          pdv_venda_fora_horario?: boolean
          plano_id_exclusivo?: string | null
          popup_informativo_ativo?: boolean
          popup_informativo_data_limite?: string | null
          popup_informativo_imagem_url?: string | null
          printer_steps?: Json | null
          qz_certificate?: string | null
          qz_program_url?: string | null
          ranking_ativo?: boolean | null
          segmento: string
          slug: string
          tempo_entrega_max?: number | null
          tempo_entrega_min?: number | null
          tolerancia_pedidos_min?: number
          updated_at?: string
          user_id: string
          valor_plano_exclusivo?: number | null
          whatsapp?: string | null
        }
        Update: {
          afiliado_id?: string | null
          ativo?: boolean
          avaliacoes_ativas?: boolean
          avaliacoes_produtos_ativas?: boolean | null
          banner_url?: string | null
          categorias_estilo?: Json
          categorias_ocultas?: Json | null
          categorias_ordem?: Json | null
          codigo_convite?: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          cupom_lembrete_ativo?: boolean
          cupom_popup_ativo?: boolean
          cupom_popup_cor_fundo?: string
          cupom_popup_cor_texto?: string
          cupom_popup_cta?: string
          cupom_popup_imagem_url?: string | null
          cupom_popup_subtitulo?: string
          cupom_popup_titulo?: string
          cupons_ativos?: boolean | null
          dias_teste_extra?: number
          documento?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          formas_pagamento?: Json | null
          frete_bairros?: Json | null
          frete_tipo?: string | null
          frete_valor_fixo?: number | null
          horario_funcionamento?: Json | null
          id?: string
          impressao_automatica?: boolean
          impressao_automatica_qz?: boolean | null
          impressao_duas_vias?: boolean | null
          impressao_status_gatilho?: string
          impressora_qz_nome?: string | null
          instagram?: string | null
          integration_fee_rate?: number | null
          lembrete_aniversario?: boolean
          logo_url?: string | null
          mais_vendidos_ativo?: boolean
          mapa_entrega_ativo?: boolean
          margem_direita?: number | null
          margem_esquerda?: number | null
          margem_inferior?: number | null
          margem_superior?: number | null
          nome?: string
          ocultar_evento?: boolean
          pdv_venda_fora_horario?: boolean
          plano_id_exclusivo?: string | null
          popup_informativo_ativo?: boolean
          popup_informativo_data_limite?: string | null
          popup_informativo_imagem_url?: string | null
          printer_steps?: Json | null
          qz_certificate?: string | null
          qz_program_url?: string | null
          ranking_ativo?: boolean | null
          segmento?: string
          slug?: string
          tempo_entrega_max?: number | null
          tempo_entrega_min?: number | null
          tolerancia_pedidos_min?: number
          updated_at?: string
          user_id?: string
          valor_plano_exclusivo?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lojas_plano_id_exclusivo_fkey"
            columns: ["plano_id_exclusivo"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_afiliado: {
        Row: {
          created_at: string
          descricao: string | null
          disponivel: boolean
          id: string
          imagem_url: string | null
          texto_whatsapp: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          disponivel?: boolean
          id?: string
          imagem_url?: string | null
          texto_whatsapp?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          disponivel?: boolean
          id?: string
          imagem_url?: string | null
          texto_whatsapp?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      online_users: {
        Row: {
          current_page: string
          id: string
          last_seen_at: string | null
          navigation_history: Json | null
          session_id: string
          session_start: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          current_page: string
          id?: string
          last_seen_at?: string | null
          navigation_history?: Json | null
          session_id: string
          session_start?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          current_page?: string
          id?: string
          last_seen_at?: string | null
          navigation_history?: Json | null
          session_id?: string
          session_start?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      pagamentos_loja: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          metodo: string
          payment_external_id: string | null
          plano_id: string | null
          plano_nome: string | null
          status: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          metodo?: string
          payment_external_id?: string | null
          plano_id?: string | null
          plano_nome?: string | null
          status?: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          metodo?: string
          payment_external_id?: string | null
          plano_id?: string | null
          plano_nome?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_loja_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_loja_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_comandas: {
        Row: {
          created_at: string
          data_abertura: string
          data_fechamento: string | null
          garcom_id: string
          id: string
          loja_id: string
          mesa_id: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          garcom_id: string
          id?: string
          loja_id: string
          mesa_id?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          garcom_id?: string
          id?: string
          loja_id?: string
          mesa_id?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_comandas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_comandas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "pdv_mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_mesas: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          lugares: number
          nome: string
          pedido_atual_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          lugares?: number
          nome: string
          pedido_atual_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          lugares?: number
          nome?: string
          pedido_atual_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_mesas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_pagamentos: {
        Row: {
          created_at: string
          id: string
          metodo: string
          pedido_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          metodo?: string
          pedido_id: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          metodo?: string
          pedido_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdv_pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pdv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_pedidos: {
        Row: {
          comanda_id: string | null
          created_at: string
          garcom_nome: string | null
          id: string
          items: Json
          last_added_at: string | null
          loja_id: string
          mesa_id: string | null
          metodo_pagamento: string | null
          numero_diario: number | null
          observacoes: string | null
          order_type: string | null
          pagamento_status: string
          status: string
          status_cozinha: string
          table_id: string | null
          total: number
          updated_at: string
          valor_pago: number
        }
        Insert: {
          comanda_id?: string | null
          created_at?: string
          garcom_nome?: string | null
          id?: string
          items?: Json
          last_added_at?: string | null
          loja_id: string
          mesa_id?: string | null
          metodo_pagamento?: string | null
          numero_diario?: number | null
          observacoes?: string | null
          order_type?: string | null
          pagamento_status?: string
          status?: string
          status_cozinha?: string
          table_id?: string | null
          total?: number
          updated_at?: string
          valor_pago?: number
        }
        Update: {
          comanda_id?: string | null
          created_at?: string
          garcom_nome?: string | null
          id?: string
          items?: Json
          last_added_at?: string | null
          loja_id?: string
          mesa_id?: string | null
          metodo_pagamento?: string | null
          numero_diario?: number | null
          observacoes?: string | null
          order_type?: string | null
          pagamento_status?: string
          status?: string
          status_cozinha?: string
          table_id?: string | null
          total?: number
          updated_at?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdv_pedidos_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "pdv_comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_pedidos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_pedidos_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "pdv_mesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_pedidos_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "pdv_mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          avaliacao: number | null
          avaliacao_comentario: string | null
          bairro_entrega: string | null
          cancel_reason: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string
          cupom_codigo: string | null
          cupom_desconto: number | null
          cupom_tipo: string | null
          endereco_entrega: string | null
          id: string
          items: Json
          latitude_entrega: number | null
          lojista_id: string
          longitude_entrega: number | null
          numero_diario: number | null
          observacoes: string | null
          order_type: string | null
          pdv_pedido_id: string | null
          status: string
          status_historico: Json
          taxa_entrega: number | null
          tipo: string
          total: number
          updated_at: string
        }
        Insert: {
          avaliacao?: number | null
          avaliacao_comentario?: string | null
          bairro_entrega?: string | null
          cancel_reason?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          cupom_codigo?: string | null
          cupom_desconto?: number | null
          cupom_tipo?: string | null
          endereco_entrega?: string | null
          id?: string
          items?: Json
          latitude_entrega?: number | null
          lojista_id: string
          longitude_entrega?: number | null
          numero_diario?: number | null
          observacoes?: string | null
          order_type?: string | null
          pdv_pedido_id?: string | null
          status?: string
          status_historico?: Json
          taxa_entrega?: number | null
          tipo?: string
          total?: number
          updated_at?: string
        }
        Update: {
          avaliacao?: number | null
          avaliacao_comentario?: string | null
          bairro_entrega?: string | null
          cancel_reason?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          cupom_codigo?: string | null
          cupom_desconto?: number | null
          cupom_tipo?: string | null
          endereco_entrega?: string | null
          id?: string
          items?: Json
          latitude_entrega?: number | null
          lojista_id?: string
          longitude_entrega?: number | null
          numero_diario?: number | null
          observacoes?: string | null
          order_type?: string | null
          pdv_pedido_id?: string | null
          status?: string
          status_historico?: Json
          taxa_entrega?: number | null
          tipo?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_pdv_pedido_id_fkey"
            columns: ["pdv_pedido_id"]
            isOneToOne: false
            referencedRelation: "pdv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_split_pagamentos: {
        Row: {
          comissao_percentual: number
          created_at: string
          id: string
          loja_id: string
          metodo: string
          payment_external_id: string | null
          pedido_id: string | null
          status: string
          updated_at: string
          valor_lojista: number
          valor_plataforma: number
          valor_total: number
        }
        Insert: {
          comissao_percentual?: number
          created_at?: string
          id?: string
          loja_id: string
          metodo?: string
          payment_external_id?: string | null
          pedido_id?: string | null
          status?: string
          updated_at?: string
          valor_lojista?: number
          valor_plataforma?: number
          valor_total?: number
        }
        Update: {
          comissao_percentual?: number
          created_at?: string
          id?: string
          loja_id?: string
          metodo?: string
          payment_external_id?: string | null
          pedido_id?: string | null
          status?: string
          updated_at?: string
          valor_lojista?: number
          valor_plataforma?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_split_pagamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_split_pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pdv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzaria_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          store_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          store_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizzaria_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzaria_configuracoes: {
        Row: {
          created_at: string
          forma_cobranca: string
          id: string
          limite_sabores: Json
          loja_id: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          forma_cobranca?: string
          id?: string
          limite_sabores?: Json
          loja_id: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          forma_cobranca?: string
          id?: string
          limite_sabores?: Json
          loja_id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pizzaria_options: {
        Row: {
          additional_price: number | null
          category_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          additional_price?: number | null
          category_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          additional_price?: number | null
          category_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizzaria_options_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pizzaria_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          comissao_afiliado: number
          created_at: string
          cta_texto: string
          descricao: string | null
          features: Json
          id: string
          limites: Json
          nome: string
          ordem: number
          periodo: string
          popular: boolean
          preco: number
          preco_promocional: number | null
          promo_duracao_meses: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comissao_afiliado?: number
          created_at?: string
          cta_texto?: string
          descricao?: string | null
          features?: Json
          id?: string
          limites?: Json
          nome: string
          ordem?: number
          periodo?: string
          popular?: boolean
          preco?: number
          preco_promocional?: number | null
          promo_duracao_meses?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comissao_afiliado?: number
          created_at?: string
          cta_texto?: string
          descricao?: string | null
          features?: Json
          id?: string
          limites?: Json
          nome?: string
          ordem?: number
          periodo?: string
          popular?: boolean
          preco?: number
          preco_promocional?: number | null
          promo_duracao_meses?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_complements: {
        Row: {
          category_id: string
          created_at: string
          id: string
          max_selection: number | null
          product_id: string
          required: boolean | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          max_selection?: number | null
          product_id: string
          required?: boolean | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          max_selection?: number | null
          product_id?: string
          required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_complements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pizzaria_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity_used: number
          size_option_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity_used: number
          size_option_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity_used?: number
          size_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_size_option_id_fkey"
            columns: ["size_option_id"]
            isOneToOne: false
            referencedRelation: "pizzaria_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          id: string
          price: number
          product_id: string
          size_option_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          product_id: string
          size_option_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          product_id?: string
          size_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_size_option_id_fkey"
            columns: ["size_option_id"]
            isOneToOne: false
            referencedRelation: "pizzaria_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          product_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          adicionais: Json | null
          allow_half: boolean | null
          banner_url: string | null
          categoria: string | null
          category_flavor_id: string | null
          created_at: string
          descricao: string | null
          disponivel: boolean
          id: string
          imagem_url: string | null
          loja_id: string
          max_adicionais: number | null
          max_flavors: number | null
          max_sabores: number | null
          max_sabores_produto: number
          nome: string
          oculto: boolean
          pedidos_count: number | null
          preco: number
          preco_promocional: number | null
          pricing_rule: string | null
          promocao_validade: string | null
          rating_average: number | null
          rating_count: number | null
          sabores: Json
          sabores_gratis: number
          tag_destaque: boolean
          tag_novo: boolean
          tag_sugestao: boolean
          tamanhos: Json | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          adicionais?: Json | null
          allow_half?: boolean | null
          banner_url?: string | null
          categoria?: string | null
          category_flavor_id?: string | null
          created_at?: string
          descricao?: string | null
          disponivel?: boolean
          id?: string
          imagem_url?: string | null
          loja_id: string
          max_adicionais?: number | null
          max_flavors?: number | null
          max_sabores?: number | null
          max_sabores_produto?: number
          nome: string
          oculto?: boolean
          pedidos_count?: number | null
          preco?: number
          preco_promocional?: number | null
          pricing_rule?: string | null
          promocao_validade?: string | null
          rating_average?: number | null
          rating_count?: number | null
          sabores?: Json
          sabores_gratis?: number
          tag_destaque?: boolean
          tag_novo?: boolean
          tag_sugestao?: boolean
          tamanhos?: Json | null
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          adicionais?: Json | null
          allow_half?: boolean | null
          banner_url?: string | null
          categoria?: string | null
          category_flavor_id?: string | null
          created_at?: string
          descricao?: string | null
          disponivel?: boolean
          id?: string
          imagem_url?: string | null
          loja_id?: string
          max_adicionais?: number | null
          max_flavors?: number | null
          max_sabores?: number | null
          max_sabores_produto?: number
          nome?: string
          oculto?: boolean
          pedidos_count?: number | null
          preco?: number
          preco_promocional?: number | null
          pricing_rule?: string | null
          promocao_validade?: string | null
          rating_average?: number | null
          rating_count?: number | null
          sabores?: Json
          sabores_gratis?: number
          tag_destaque?: boolean
          tag_novo?: boolean
          tag_sugestao?: boolean
          tamanhos?: Json | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_category_flavor_id_fkey"
            columns: ["category_flavor_id"]
            isOneToOne: false
            referencedRelation: "pizzaria_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          codigo_acesso: string | null
          codigo_admin: string | null
          codigo_afiliado: string | null
          comissao_percent: number | null
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          pix_chave: string | null
          pix_nome_favorecido: string | null
          pix_tipo: string | null
          security_answer: string | null
          senha_painel: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          codigo_acesso?: string | null
          codigo_admin?: string | null
          codigo_afiliado?: string | null
          comissao_percent?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_chave?: string | null
          pix_nome_favorecido?: string | null
          pix_tipo?: string | null
          security_answer?: string | null
          senha_painel?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          codigo_acesso?: string | null
          codigo_admin?: string | null
          codigo_afiliado?: string | null
          comissao_percent?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_chave?: string | null
          pix_nome_favorecido?: string | null
          pix_tipo?: string | null
          security_answer?: string | null
          senha_painel?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qz_certificates: {
        Row: {
          certificate_content: string
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
          private_key_content: string
          updated_at: string | null
        }
        Insert: {
          certificate_content: string
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          private_key_content: string
          updated_at?: string | null
        }
        Update: {
          certificate_content?: string
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          private_key_content?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saques: {
        Row: {
          afiliado_id: string
          created_at: string
          id: string
          motivo_rejeicao: string | null
          pago_em: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          afiliado_id: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          afiliado_id?: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      suporte_mensagens: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_read_at: string | null
          created_at: string
          description: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          source: string | null
          status: string
          store_id: string | null
          store_read_at: string | null
          subject: string
          ticket_number: number | null
          updated_at: string
        }
        Insert: {
          admin_read_at?: string | null
          created_at?: string
          description?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          source?: string | null
          status?: string
          store_id?: string | null
          store_read_at?: string | null
          subject: string
          ticket_number?: number | null
          updated_at?: string
        }
        Update: {
          admin_read_at?: string | null
          created_at?: string
          description?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          source?: string | null
          status?: string
          store_id?: string | null
          store_read_at?: string | null
          subject?: string
          ticket_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      system_rating_optouts: {
        Row: {
          cliente_nome: string | null
          cliente_telefone: string
          created_at: string
          id: string
          loja_id: string | null
        }
        Insert: {
          cliente_nome?: string | null
          cliente_telefone: string
          created_at?: string
          id?: string
          loja_id?: string | null
        }
        Update: {
          cliente_nome?: string | null
          cliente_telefone?: string
          created_at?: string
          id?: string
          loja_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_rating_optouts_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      system_rating_settings: {
        Row: {
          enabled: boolean
          event_image_url: string | null
          id: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          event_image_url?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          event_image_url?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_ratings: {
        Row: {
          cliente_nome: string | null
          cliente_telefone: string
          created_at: string
          id: string
          loja_id: string | null
          observacoes: string | null
          rating: string
        }
        Insert: {
          cliente_nome?: string | null
          cliente_telefone: string
          created_at?: string
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          rating: string
        }
        Update: {
          cliente_nome?: string | null
          cliente_telefone?: string
          created_at?: string
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_ratings_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      uso_cupons: {
        Row: {
          cliente_identificador: string
          created_at: string
          cupom_id: string
          id: string
          pedido_id: string
          valor_desconto: number
        }
        Insert: {
          cliente_identificador: string
          created_at?: string
          cupom_id: string
          id?: string
          pedido_id: string
          valor_desconto: number
        }
        Update: {
          cliente_identificador?: string
          created_at?: string
          cupom_id?: string
          id?: string
          pedido_id?: string
          valor_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "uso_cupons_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uso_cupons_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_app_version: {
        Args: never
        Returns: {
          major: number
          minor: number
        }[]
      }
      clean_old_online_sessions: { Args: never; Returns: undefined }
      delete_loja_complete: { Args: { p_loja_id: string }; Returns: undefined }
      get_column_stats: {
        Args: never
        Returns: {
          column_count: number
          table_name: string
        }[]
      }
      get_db_stats: {
        Args: never
        Returns: {
          row_count: number
          table_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      system_rating_status: {
        Args: { _telefone: string }
        Returns: {
          has_opted_out: boolean
          has_voted: boolean
        }[]
      }
    }
    Enums: {
      app_cupom_tipo: "fixo" | "percentual" | "frete_gratis" | "cliente_novo"
      app_role: "admin" | "lojista" | "afiliado" | "entregador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_cupom_tipo: ["fixo", "percentual", "frete_gratis", "cliente_novo"],
      app_role: ["admin", "lojista", "afiliado", "entregador"],
    },
  },
} as const
