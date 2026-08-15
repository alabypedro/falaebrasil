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
      ai_xp_events: {
        Row: {
          created_at: string
          id: string
          key: string
          points: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          points?: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          points?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          cpf_cnpj: string | null
          created_at: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_payments: {
        Row: {
          access_grant_result: Json | null
          access_granted_at: string | null
          asaas_payment_id: string
          asaas_subscription_id: string | null
          bank_slip_url: string | null
          billing_type: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_url: string | null
          net_value_cents: number | null
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          product_key: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
          user_id: string | null
          value_cents: number
        }
        Insert: {
          access_grant_result?: Json | null
          access_granted_at?: string | null
          asaas_payment_id: string
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          net_value_cents?: number | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          product_key?: string | null
          raw_payload?: Json | null
          status: string
          updated_at?: string
          user_id?: string | null
          value_cents?: number
        }
        Update: {
          access_grant_result?: Json | null
          access_granted_at?: string | null
          asaas_payment_id?: string
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          net_value_cents?: number | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          product_key?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
          value_cents?: number
        }
        Relationships: []
      }
      asaas_subscriptions: {
        Row: {
          asaas_subscription_id: string
          canceled_at: string | null
          created_at: string
          cycle: Database["public"]["Enums"]["payment_billing_cycle"] | null
          id: string
          next_due_date: string | null
          product_key: string
          status: string
          updated_at: string
          user_id: string
          value_cents: number
        }
        Insert: {
          asaas_subscription_id: string
          canceled_at?: string | null
          created_at?: string
          cycle?: Database["public"]["Enums"]["payment_billing_cycle"] | null
          id?: string
          next_due_date?: string | null
          product_key: string
          status?: string
          updated_at?: string
          user_id: string
          value_cents?: number
        }
        Update: {
          asaas_subscription_id?: string
          canceled_at?: string | null
          created_at?: string
          cycle?: Database["public"]["Enums"]["payment_billing_cycle"] | null
          id?: string
          next_due_date?: string | null
          product_key?: string
          status?: string
          updated_at?: string
          user_id?: string
          value_cents?: number
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          payment_id: string | null
          processed_at: string
          raw_payload: Json
          result: Json | null
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          payment_id?: string | null
          processed_at?: string
          raw_payload: Json
          result?: Json | null
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          payment_id?: string | null
          processed_at?: string
          raw_payload?: Json
          result?: Json | null
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bst_product_access: {
        Row: {
          created_at: string
          granted_at: string
          id: string
          product_id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          id?: string
          product_id: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          id?: string
          product_id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bst_product_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
        ]
      }
      bst_product_pdfs: {
        Row: {
          bst_product_id: string
          created_at: string
          id: string
          level: string
          pdf_url: string | null
          title: string | null
          unit: number
          updated_at: string
        }
        Insert: {
          bst_product_id: string
          created_at?: string
          id?: string
          level: string
          pdf_url?: string | null
          title?: string | null
          unit: number
          updated_at?: string
        }
        Update: {
          bst_product_id?: string
          created_at?: string
          id?: string
          level?: string
          pdf_url?: string | null
          title?: string | null
          unit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bst_product_pdfs_bst_product_id_fkey"
            columns: ["bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
        ]
      }
      bst_products: {
        Row: {
          active: boolean
          checkout_url: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          pdf_url: string | null
          price_cents: number
          primary_tool: string
          secondary_tool: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          pdf_url?: string | null
          price_cents?: number
          primary_tool?: string
          secondary_tool?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          pdf_url?: string | null
          price_cents?: number
          primary_tool?: string
          secondary_tool?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bst_voice_scripts: {
        Row: {
          bst_product_id: string
          created_at: string
          display_order: number
          id: string
          level: string
          script_text: string
          title: string
          updated_at: string
        }
        Insert: {
          bst_product_id: string
          created_at?: string
          display_order?: number
          id?: string
          level?: string
          script_text: string
          title: string
          updated_at?: string
        }
        Update: {
          bst_product_id?: string
          created_at?: string
          display_order?: number
          id?: string
          level?: string
          script_text?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bst_voice_scripts_bst_product_id_fkey"
            columns: ["bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          feedback: Json | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          feedback?: Json | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          feedback?: Json | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_channels: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          level: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          level?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          level?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_messages: {
        Row: {
          audio_duration_seconds: number | null
          audio_url: string | null
          channel_id: string
          content: string | null
          created_at: string
          id: string
          message_type: string
          user_id: string
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_url?: string | null
          channel_id: string
          content?: string | null
          created_at?: string
          id?: string
          message_type?: string
          user_id: string
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_url?: string | null
          channel_id?: string
          content?: string | null
          created_at?: string
          id?: string
          message_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          tier: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          tier: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          tier?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      course_progress: {
        Row: {
          completed: boolean
          course_id: string
          created_at: string
          id: string
          module_index: number
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          completed?: boolean
          course_id: string
          created_at?: string
          id?: string
          module_index?: number
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          completed?: boolean
          course_id?: string
          created_at?: string
          id?: string
          module_index?: number
          updated_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          level: string
          published: boolean
          required_tier: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          level?: string
          published?: boolean
          required_tier?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          level?: string
          published?: boolean
          required_tier?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fb_cefr_metrics: {
        Row: {
          created_at: string
          id: string
          level: string
          mode: string
          perceived_quality: number | null
          response_time_ms: number | null
          score: number | null
          session_id: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          mode: string
          perceived_quality?: number | null
          response_time_ms?: number | null
          score?: number | null
          session_id: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          mode?: string
          perceived_quality?: number | null
          response_time_ms?: number | null
          score?: number | null
          session_id?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_cefr_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_communities: {
        Row: {
          access_key: string
          all_tiers: boolean
          created_at: string
          description: string | null
          id: string
          required_tier: string
          sort_order: number
          title: string
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          access_key?: string
          all_tiers?: boolean
          created_at?: string
          description?: string | null
          id?: string
          required_tier?: string
          sort_order?: number
          title: string
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          access_key?: string
          all_tiers?: boolean
          created_at?: string
          description?: string | null
          id?: string
          required_tier?: string
          sort_order?: number
          title?: string
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      hubla_product_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          product_mapping_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          product_mapping_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          product_mapping_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubla_product_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hubla_product_courses_product_mapping_id_fkey"
            columns: ["product_mapping_id"]
            isOneToOne: false
            referencedRelation: "hubla_product_mapping"
            referencedColumns: ["id"]
          },
        ]
      }
      hubla_product_mapping: {
        Row: {
          checkout_url: string | null
          created_at: string
          display_name: string
          grants_course: boolean
          grants_ebook1: boolean
          grants_ebook2: boolean
          grants_ebook3: boolean
          grants_tier: string | null
          hubla_product_id: string | null
          hubla_product_name: string | null
          id: string
          is_subscription: boolean
          price_cents: number
          product_key: string
          updated_at: string
        }
        Insert: {
          checkout_url?: string | null
          created_at?: string
          display_name: string
          grants_course?: boolean
          grants_ebook1?: boolean
          grants_ebook2?: boolean
          grants_ebook3?: boolean
          grants_tier?: string | null
          hubla_product_id?: string | null
          hubla_product_name?: string | null
          id?: string
          is_subscription?: boolean
          price_cents?: number
          product_key: string
          updated_at?: string
        }
        Update: {
          checkout_url?: string | null
          created_at?: string
          display_name?: string
          grants_course?: boolean
          grants_ebook1?: boolean
          grants_ebook2?: boolean
          grants_ebook3?: boolean
          grants_tier?: string | null
          hubla_product_id?: string | null
          hubla_product_name?: string | null
          id?: string
          is_subscription?: boolean
          price_cents?: number
          product_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      install_tutorial_videos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          platform: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          platform: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          platform?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      leiae_texts: {
        Row: {
          bst_product_id: string | null
          content: string
          course_id: string | null
          created_at: string
          display_order: number
          id: string
          level: string
          title: string
          unit: number | null
          updated_at: string
        }
        Insert: {
          bst_product_id?: string | null
          content: string
          course_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          level?: string
          title: string
          unit?: number | null
          updated_at?: string
        }
        Update: {
          bst_product_id?: string | null
          content?: string
          course_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          level?: string
          title?: string
          unit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leiae_texts_bst_product_id_fkey"
            columns: ["bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leiae_texts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_videos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          lesson_id: string
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          lesson_id: string
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          lesson_id?: string
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_videos_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          module_id: string
          pdf_url: string | null
          practice_text: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          module_id: string
          pdf_url?: string | null
          practice_text?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          module_id?: string
          pdf_url?: string | null
          practice_text?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      library_bst: {
        Row: {
          access_key: string
          audio_url: string | null
          created_at: string
          file_url: string | null
          id: string
          title: string
          type: string
        }
        Insert: {
          access_key?: string
          audio_url?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          title: string
          type: string
        }
        Update: {
          access_key?: string
          audio_url?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      listening_lessons: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          id: string
          level: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          level?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          level?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      memorize_cards: {
        Row: {
          audio_url: string | null
          back_text: string
          created_at: string
          deck_id: string
          display_order: number
          example_sentence: string | null
          front_text: string
          id: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          back_text: string
          created_at?: string
          deck_id: string
          display_order?: number
          example_sentence?: string | null
          front_text: string
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          back_text?: string
          created_at?: string
          deck_id?: string
          display_order?: number
          example_sentence?: string | null
          front_text?: string
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorize_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "memorize_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      memorize_decks: {
        Row: {
          bst_product_id: string | null
          course_id: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          target_topic: string
          title: string
          updated_at: string
        }
        Insert: {
          bst_product_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          target_topic?: string
          title: string
          updated_at?: string
        }
        Update: {
          bst_product_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          target_topic?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorize_decks_bst_product_id_fkey"
            columns: ["bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorize_decks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_product_bundles: {
        Row: {
          created_at: string
          id: string
          included_product_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          included_product_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          included_product_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_product_bundles_included_product_id_fkey"
            columns: ["included_product_id"]
            isOneToOne: false
            referencedRelation: "payment_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_product_bundles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "payment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_product_coupons: {
        Row: {
          active: boolean
          checkout_url: string
          code: string
          created_at: string
          id: string
          price_cents: number
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          checkout_url: string
          code: string
          created_at?: string
          id?: string
          price_cents?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          checkout_url?: string
          code?: string
          created_at?: string
          id?: string
          price_cents?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_product_coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "payment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_product_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_product_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_product_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "payment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_products: {
        Row: {
          active: boolean
          billing_cycle:
            | Database["public"]["Enums"]["payment_billing_cycle"]
            | null
          checkout_url: string | null
          created_at: string
          description: string | null
          display_order: number
          grants_bst_product_id: string | null
          grants_category: string | null
          grants_course_access: boolean
          grants_ebook1_access: boolean
          grants_ebook2_access: boolean
          grants_ebook3_access: boolean
          grants_scripted_seconds: number
          grants_unscripted_seconds: number
          id: string
          name: string
          plan_tier: string | null
          price_cents: number
          product_key: string
          type: Database["public"]["Enums"]["payment_product_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_cycle?:
            | Database["public"]["Enums"]["payment_billing_cycle"]
            | null
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          grants_bst_product_id?: string | null
          grants_category?: string | null
          grants_course_access?: boolean
          grants_ebook1_access?: boolean
          grants_ebook2_access?: boolean
          grants_ebook3_access?: boolean
          grants_scripted_seconds?: number
          grants_unscripted_seconds?: number
          id?: string
          name: string
          plan_tier?: string | null
          price_cents?: number
          product_key: string
          type?: Database["public"]["Enums"]["payment_product_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_cycle?:
            | Database["public"]["Enums"]["payment_billing_cycle"]
            | null
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          grants_bst_product_id?: string | null
          grants_category?: string | null
          grants_course_access?: boolean
          grants_ebook1_access?: boolean
          grants_ebook2_access?: boolean
          grants_ebook3_access?: boolean
          grants_scripted_seconds?: number
          grants_unscripted_seconds?: number
          id?: string
          name?: string
          plan_tier?: string | null
          price_cents?: number
          product_key?: string
          type?: Database["public"]["Enums"]["payment_product_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_products_grants_bst_product_id_fkey"
            columns: ["grants_bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_products_grants_category_fkey"
            columns: ["grants_category"]
            isOneToOne: false
            referencedRelation: "student_category_defs"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          avatar_url: string | null
          best_listening_score: number | null
          best_scripted_score: number | null
          best_unscripted_score: number | null
          best_writing_score: number | null
          created_at: string
          display_name: string | null
          email: string | null
          has_a2_access: boolean
          has_b1_access: boolean
          has_b2_access: boolean
          has_course_access: boolean
          has_ebook1_access: boolean
          has_ebook2_access: boolean
          has_ebook3_access: boolean
          has_seen_bst_tutorial: boolean
          has_seen_tutorial: boolean
          hubla_customer_id: string | null
          hubla_subscription_id: string | null
          id: string
          last_activity: string | null
          last_notification_sent: string | null
          level: string
          phone: string | null
          plan_tier: string
          scripted_balance: number
          streak_days: number
          subscription_current_period_end: string | null
          subscription_grace_until: string | null
          subscription_status: string
          unscripted_balance: number
          updated_at: string
          user_id: string
          user_type: string
          welcome_email_sent_at: string | null
          xp: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          best_listening_score?: number | null
          best_scripted_score?: number | null
          best_unscripted_score?: number | null
          best_writing_score?: number | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_a2_access?: boolean
          has_b1_access?: boolean
          has_b2_access?: boolean
          has_course_access?: boolean
          has_ebook1_access?: boolean
          has_ebook2_access?: boolean
          has_ebook3_access?: boolean
          has_seen_bst_tutorial?: boolean
          has_seen_tutorial?: boolean
          hubla_customer_id?: string | null
          hubla_subscription_id?: string | null
          id?: string
          last_activity?: string | null
          last_notification_sent?: string | null
          level?: string
          phone?: string | null
          plan_tier?: string
          scripted_balance?: number
          streak_days?: number
          subscription_current_period_end?: string | null
          subscription_grace_until?: string | null
          subscription_status?: string
          unscripted_balance?: number
          updated_at?: string
          user_id: string
          user_type?: string
          welcome_email_sent_at?: string | null
          xp?: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          best_listening_score?: number | null
          best_scripted_score?: number | null
          best_unscripted_score?: number | null
          best_writing_score?: number | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_a2_access?: boolean
          has_b1_access?: boolean
          has_b2_access?: boolean
          has_course_access?: boolean
          has_ebook1_access?: boolean
          has_ebook2_access?: boolean
          has_ebook3_access?: boolean
          has_seen_bst_tutorial?: boolean
          has_seen_tutorial?: boolean
          hubla_customer_id?: string | null
          hubla_subscription_id?: string | null
          id?: string
          last_activity?: string | null
          last_notification_sent?: string | null
          level?: string
          phone?: string | null
          plan_tier?: string
          scripted_balance?: number
          streak_days?: number
          subscription_current_period_end?: string | null
          subscription_grace_until?: string | null
          subscription_status?: string
          unscripted_balance?: number
          updated_at?: string
          user_id?: string
          user_type?: string
          welcome_email_sent_at?: string | null
          xp?: number
        }
        Relationships: []
      }
      pronunciation_prompts: {
        Row: {
          created_at: string
          id: string
          level: string
          source_file: string | null
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          source_file?: string | null
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          source_file?: string | null
          text?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscription_data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscription_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          passed: boolean
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id: string
          score?: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_option_index: number
          created_at: string
          display_order: number
          id: string
          options: Json
          question_text: string
          quiz_id: string
        }
        Insert: {
          correct_option_index?: number
          created_at?: string
          display_order?: number
          id?: string
          options?: Json
          question_text: string
          quiz_id: string
        }
        Update: {
          correct_option_index?: number
          created_at?: string
          display_order?: number
          id?: string
          options?: Json
          question_text?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          bst_product_id: string | null
          created_at: string
          display_order: number
          id: string
          lesson_id: string | null
          level: string
          passing_score: number
          title: string
          unit: number | null
          updated_at: string
        }
        Insert: {
          bst_product_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          lesson_id?: string | null
          level?: string
          passing_score?: number
          title: string
          unit?: number | null
          updated_at?: string
        }
        Update: {
          bst_product_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          lesson_id?: string | null
          level?: string
          passing_score?: number
          title?: string
          unit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_bst_product_id_fkey"
            columns: ["bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_seconds: number
          fluency_score: number | null
          grammar_score: number | null
          id: string
          mode: string
          prompt_text: string | null
          pronunciation_score: number | null
          transcription: string | null
          user_id: string
          vocabulary_score: number | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          mode: string
          prompt_text?: string | null
          pronunciation_score?: number | null
          transcription?: string | null
          user_id: string
          vocabulary_score?: number | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          mode?: string
          prompt_text?: string | null
          pronunciation_score?: number | null
          transcription?: string | null
          user_id?: string
          vocabulary_score?: number | null
        }
        Relationships: []
      }
      student_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_categories_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "student_category_defs"
            referencedColumns: ["code"]
          },
        ]
      }
      student_category_defs: {
        Row: {
          bst_product_id: string | null
          code: string
          created_at: string
          display_order: number
          kind: string
          label: string
          updated_at: string
        }
        Insert: {
          bst_product_id?: string | null
          code: string
          created_at?: string
          display_order?: number
          kind: string
          label: string
          updated_at?: string
        }
        Update: {
          bst_product_id?: string | null
          code?: string
          created_at?: string
          display_order?: number
          kind?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_category_defs_bst_product_id_fkey"
            columns: ["bst_product_id"]
            isOneToOne: false
            referencedRelation: "bst_products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      token_recharge_log: {
        Row: {
          id: string
          month: number
          recharged_at: string | null
          scripted_amount: number
          unscripted_amount: number
          users_count: number
          year: number
        }
        Insert: {
          id?: string
          month: number
          recharged_at?: string | null
          scripted_amount: number
          unscripted_amount: number
          users_count: number
          year: number
        }
        Update: {
          id?: string
          month?: number
          recharged_at?: string | null
          scripted_amount?: number
          unscripted_amount?: number
          users_count?: number
          year?: number
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_published: boolean
          slug: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          slug?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          slug?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_card_reviews: {
        Row: {
          card_id: string
          created_at: string
          due_at: string
          ease_factor: number
          id: string
          interval_days: number
          lapses: number
          last_rating: number | null
          last_reviewed_at: string | null
          repetitions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          due_at?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          lapses?: number
          last_rating?: number | null
          last_reviewed_at?: string | null
          repetitions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          due_at?: string
          ease_factor?: number
          id?: string
          interval_days?: number
          lapses?: number
          last_rating?: number | null
          last_reviewed_at?: string | null
          repetitions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_card_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "memorize_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_course_access: {
        Row: {
          course_id: string
          granted_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          course_id: string
          granted_at?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          course_id?: string
          granted_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_course_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
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
      user_video_progress: {
        Row: {
          completed_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "lesson_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_config: {
        Row: {
          id: number
          paid_chat_url: string | null
          teacher_chat_url: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          paid_chat_url?: string | null
          teacher_chat_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          paid_chat_url?: string | null
          teacher_chat_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      voice_credit_grants: {
        Row: {
          created_at: string
          hubla_event_id: string
          hubla_product_id: string
          id: string
          raw_payload: Json | null
          scripted_seconds_added: number
          unscripted_seconds_added: number
          user_id: string
        }
        Insert: {
          created_at?: string
          hubla_event_id: string
          hubla_product_id: string
          id?: string
          raw_payload?: Json | null
          scripted_seconds_added?: number
          unscripted_seconds_added?: number
          user_id: string
        }
        Update: {
          created_at?: string
          hubla_event_id?: string
          hubla_product_id?: string
          id?: string
          raw_payload?: Json | null
          scripted_seconds_added?: number
          unscripted_seconds_added?: number
          user_id?: string
        }
        Relationships: []
      }
      voice_credit_products: {
        Row: {
          created_at: string
          display_name: string
          hubla_product_id: string
          id: string
          scripted_seconds: number
          unscripted_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          hubla_product_id: string
          id?: string
          scripted_seconds?: number
          unscripted_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          hubla_product_id?: string
          id?: string
          scripted_seconds?: number
          unscripted_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      voice_sessions: {
        Row: {
          accuracy_score: number | null
          created_at: string
          fluency_score: number | null
          grammar_feedback: string | null
          id: string
          mode: string
          prosody_score: number | null
          text_analyzed: string | null
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string
          fluency_score?: number | null
          grammar_feedback?: string | null
          id?: string
          mode: string
          prosody_score?: number | null
          text_analyzed?: string | null
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string
          fluency_score?: number | null
          grammar_feedback?: string | null
          id?: string
          mode?: string
          prosody_score?: number | null
          text_analyzed?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      library_bst_safe: {
        Row: {
          access_key: string | null
          audio_url: string | null
          created_at: string | null
          file_url: string | null
          id: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          access_key?: string | null
          audio_url?: never
          created_at?: string | null
          file_url?: never
          id?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          access_key?: string | null
          audio_url?: never
          created_at?: string | null
          file_url?: never
          id?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          level: string | null
          streak_days: number | null
          updated_at: string | null
          user_id: string | null
          user_type: string | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          level?: string | null
          streak_days?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_type?: string | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          level?: string | null
          streak_days?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_type?: string | null
          xp?: number | null
        }
        Relationships: []
      }
      quiz_questions_public: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string | null
          options: Json | null
          question_text: string | null
          quiz_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string | null
          options?: Json | null
          question_text?: string | null
          quiz_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string | null
          options?: Json | null
          question_text?: string | null
          quiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_ranking: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          level: string | null
          rank_position: number | null
          total_xp: number | null
          user_id: string | null
          user_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _strip_correct_index: { Args: { _content: Json }; Returns: Json }
      apply_student_category: {
        Args: { _code: string; _source?: string; _user_id: string }
        Returns: undefined
      }
      award_ai_xp: {
        Args: { _key: string; _points: number; _source: string }
        Returns: Json
      }
      calculate_level_from_xp: { Args: { _xp: number }; Returns: string }
      can_access_level: { Args: { _level: string }; Returns: boolean }
      complete_video: { Args: { _video_id: string }; Returns: Json }
      debit_scripted_seconds: { Args: { _seconds: number }; Returns: Json }
      debit_unscripted_seconds: { Args: { _seconds: number }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_overdue_subscriptions: { Args: never; Returns: Json }
      get_latest_quiz_attempt: { Args: { _quiz_id: string }; Returns: Json }
      get_listening_lessons_public: {
        Args: never
        Returns: {
          content: Json
          created_at: string
          description: string
          id: string
          level: string
          title: string
        }[]
      }
      grade_listening_lesson: {
        Args: { _answers: Json; _lesson_id: string }
        Returns: Json
      }
      grant_access_from_asaas: {
        Args: {
          _asaas_payment_id: string
          _product_key: string
          _raw?: Json
          _user_id: string
        }
        Returns: Json
      }
      grant_voice_credits: {
        Args: {
          _hubla_event_id: string
          _hubla_product_id: string
          _raw_payload?: Json
          _user_id: string
        }
        Returns: Json
      }
      has_bst_item_access: { Args: { _access_key: string }; Returns: boolean }
      has_bst_product_access: {
        Args: { _product_id: string }
        Returns: boolean
      }
      has_course_access: { Args: { _course_id: string }; Returns: boolean }
      has_open_category: { Args: { _user_id: string }; Returns: boolean }
      has_open_category_raw: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tier: { Args: { _required: string }; Returns: boolean }
      is_bst_restricted: { Args: { _user_id: string }; Returns: boolean }
      level_rank: { Args: { _level: string }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recharge_monthly_tokens: { Args: never; Returns: undefined }
      reset_all_progress: { Args: never; Returns: Json }
      reset_course_progress: { Args: { _course_id: string }; Returns: Json }
      submit_card_review: {
        Args: { _card_id: string; _rating: number }
        Returns: Json
      }
      submit_quiz: { Args: { _answers: Json; _quiz_id: string }; Returns: Json }
      subscription_is_current: { Args: { _user_id: string }; Returns: boolean }
      tier_rank: { Args: { _tier: string }; Returns: number }
      uncomplete_video: { Args: { _video_id: string }; Returns: Json }
      update_best_score: {
        Args: { _kind: string; _value: number }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "teacher"
      payment_billing_cycle:
        | "MONTHLY"
        | "YEARLY"
        | "WEEKLY"
        | "QUARTERLY"
        | "SEMIANNUALLY"
      payment_product_type: "subscription" | "one_time"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user", "teacher"],
      payment_billing_cycle: [
        "MONTHLY",
        "YEARLY",
        "WEEKLY",
        "QUARTERLY",
        "SEMIANNUALLY",
      ],
      payment_product_type: ["subscription", "one_time"],
    },
  },
} as const
