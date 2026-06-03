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
      profiles: {
        Row: {
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
          created_at: string
          id: string
          lesson_id: string
          passing_score: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          passing_score?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          passing_score?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
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
      calculate_level_from_xp: { Args: { _xp: number }; Returns: string }
      can_access_level: { Args: { _level: string }; Returns: boolean }
      complete_video: { Args: { _video_id: string }; Returns: Json }
      debit_scripted_seconds: { Args: { _seconds: number }; Returns: Json }
      debit_unscripted_seconds: { Args: { _seconds: number }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_overdue_subscriptions: { Args: never; Returns: Json }
      get_latest_quiz_attempt: { Args: { _quiz_id: string }; Returns: Json }
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
      has_course_access: { Args: { _course_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tier: { Args: { _required: string }; Returns: boolean }
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
      submit_quiz: { Args: { _answers: Json; _quiz_id: string }; Returns: Json }
      tier_rank: { Args: { _tier: string }; Returns: number }
      uncomplete_video: { Args: { _video_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
