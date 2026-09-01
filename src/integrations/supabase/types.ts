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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          amount: number
          created_at: string
          hold_expires_at: string | null
          id: string
          origin_application_id: string | null
          paid: boolean
          period: unknown
          room_id: string
          slot_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          hold_expires_at?: string | null
          id?: string
          origin_application_id?: string | null
          paid?: boolean
          period: unknown
          room_id: string
          slot_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          hold_expires_at?: string | null
          id?: string
          origin_application_id?: string | null
          paid?: boolean
          period?: unknown
          room_id?: string
          slot_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_origin_application_id_fkey"
            columns: ["origin_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "bookable_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "room_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_slides: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_path: string | null
          image_url: string
          is_active: boolean
          link: string | null
          slide_no: number
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          image_url: string
          is_active?: boolean
          link?: string | null
          slide_no?: never
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          image_url?: string
          is_active?: boolean
          link?: string | null
          slide_no?: never
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          first_response_at: string | null
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          first_response_at?: string | null
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          first_response_at?: string | null
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      door_pins: {
        Row: {
          assigned_booking_id: string | null
          created_at: string
          id: string
          pin: string
          studio_id: string
          used: boolean
        }
        Insert: {
          assigned_booking_id?: string | null
          created_at?: string
          id?: string
          pin: string
          studio_id: string
          used?: boolean
        }
        Update: {
          assigned_booking_id?: string | null
          created_at?: string
          id?: string
          pin?: string
          studio_id?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "door_pins_assigned_booking_id_fkey"
            columns: ["assigned_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_pins_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          message: string | null
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_name: string
          created_at: string
          id: string
          is_read: boolean
          post_id: string | null
          post_title: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_name?: string
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          post_title?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_name?: string
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          post_title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_ratings: {
        Row: {
          created_at: string
          disputed: boolean
          id: string
          job_application_id: string | null
          kept_promise: boolean | null
          ratee_id: string
          rater_id: string
          skill_matched: boolean | null
          updated_at: string
          would_again: boolean | null
        }
        Insert: {
          created_at?: string
          disputed?: boolean
          id?: string
          job_application_id?: string | null
          kept_promise?: boolean | null
          ratee_id: string
          rater_id: string
          skill_matched?: boolean | null
          updated_at?: string
          would_again?: boolean | null
        }
        Update: {
          created_at?: string
          disputed?: boolean
          id?: string
          job_application_id?: string | null
          kept_promise?: boolean | null
          ratee_id?: string
          rater_id?: string
          skill_matched?: boolean | null
          updated_at?: string
          would_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_ratings_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hours: string | null
          id: string
          lat: number
          lng: number
          name: string
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hours?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          phone?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hours?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          applicant_level: string
          area: string | null
          author_name: string
          category: string | null
          closed_at: string | null
          comment_count: number
          content: string
          created_at: string
          deadline_at: string | null
          headcount: number | null
          hours: string | null
          id: string
          image_url: string | null
          instruments: string[] | null
          is_urgent: boolean
          lat: number | null
          like_count: number
          lng: number | null
          pay: string | null
          phone: string | null
          popularity: number | null
          position: string | null
          post_type: string
          price: string | null
          rehearsal_slots: string[] | null
          schedule: string | null
          status: string
          subcategory: string | null
          title: string
          updated_at: string
          user_id: string
          venue: string | null
        }
        Insert: {
          applicant_level?: string
          area?: string | null
          author_name?: string
          category?: string | null
          closed_at?: string | null
          comment_count?: number
          content: string
          created_at?: string
          deadline_at?: string | null
          headcount?: number | null
          hours?: string | null
          id?: string
          image_url?: string | null
          instruments?: string[] | null
          is_urgent?: boolean
          lat?: number | null
          like_count?: number
          lng?: number | null
          pay?: string | null
          phone?: string | null
          popularity?: number | null
          position?: string | null
          post_type: string
          price?: string | null
          rehearsal_slots?: string[] | null
          schedule?: string | null
          status?: string
          subcategory?: string | null
          title: string
          updated_at?: string
          user_id: string
          venue?: string | null
        }
        Update: {
          applicant_level?: string
          area?: string | null
          author_name?: string
          category?: string | null
          closed_at?: string | null
          comment_count?: number
          content?: string
          created_at?: string
          deadline_at?: string | null
          headcount?: number | null
          hours?: string | null
          id?: string
          image_url?: string | null
          instruments?: string[] | null
          is_urgent?: boolean
          lat?: number | null
          like_count?: number
          lng?: number | null
          pay?: string | null
          phone?: string | null
          popularity?: number | null
          position?: string | null
          post_type?: string
          price?: string | null
          rehearsal_slots?: string[] | null
          schedule?: string | null
          status?: string
          subcategory?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: []
      }
      profile_credentials: {
        Row: {
          created_at: string
          id: string
          kind: string
          purge_after: string | null
          status: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          purge_after?: string | null
          status?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          purge_after?: string | null
          status?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          available_slots: string[]
          available_times: string[] | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          credential_verified: boolean
          display_name: string | null
          genres: string[] | null
          handle: string | null
          hide_presence: boolean
          id: string
          instruments: string[] | null
          last_seen_at: string | null
          location: string | null
          purpose: string | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          available_slots?: string[]
          available_times?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          credential_verified?: boolean
          display_name?: string | null
          genres?: string[] | null
          handle?: string | null
          hide_presence?: boolean
          id?: string
          instruments?: string[] | null
          last_seen_at?: string | null
          location?: string | null
          purpose?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          available_slots?: string[]
          available_times?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          credential_verified?: boolean
          display_name?: string | null
          genres?: string[] | null
          handle?: string | null
          hide_presence?: boolean
          id?: string
          instruments?: string[] | null
          last_seen_at?: string | null
          location?: string | null
          purpose?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rating_reports: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          rating_id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          rating_id: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          rating_id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_reports_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "peer_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reservation_cancellations: {
        Row: {
          cancelled_by: string | null
          created_at: string
          end_at: string
          id: string
          reason: string
          reservation_id: string
          room_id: string
          start_at: string
          user_id: string
        }
        Insert: {
          cancelled_by?: string | null
          created_at?: string
          end_at: string
          id?: string
          reason: string
          reservation_id: string
          room_id: string
          start_at: string
          user_id: string
        }
        Update: {
          cancelled_by?: string | null
          created_at?: string
          end_at?: string
          id?: string
          reason?: string
          reservation_id?: string
          room_id?: string
          start_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_reservations: {
        Row: {
          created_at: string
          end_at: string
          id: string
          note: string | null
          room_id: string
          start_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          note?: string | null
          room_id: string
          start_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          note?: string | null
          room_id?: string
          start_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_slots: {
        Row: {
          created_at: string
          end_at: string
          id: string
          is_open: boolean
          room_id: string
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          is_open?: boolean
          room_id: string
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          is_open?: boolean
          room_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          hourly_price: number
          id: string
          name: string
          studio_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          hourly_price?: number
          id?: string
          name: string
          studio_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          hourly_price?: number
          id?: string
          name?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          owner_id: string
          phone: string | null
          tier: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          owner_id: string
          phone?: string | null
          tier?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          tier?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          grade: string
          median_response_h: number | null
          no_show_count: number
          partners_count: number
          positive_rate: number | null
          rehire_rate: number | null
          response_rate: number | null
          review_count: number
          sessions_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          grade?: string
          median_response_h?: number | null
          no_show_count?: number
          partners_count?: number
          positive_rate?: number | null
          rehire_rate?: number | null
          response_rate?: number | null
          review_count?: number
          sessions_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          grade?: string
          median_response_h?: number | null
          no_show_count?: number
          partners_count?: number
          positive_rate?: number | null
          rehire_rate?: number | null
          response_rate?: number | null
          review_count?: number
          sessions_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bookable_slots: {
        Row: {
          created_at: string | null
          end_at: string | null
          id: string | null
          is_open: boolean | null
          room_id: string | null
          start_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_at?: string | null
          id?: string | null
          is_open?: boolean | null
          room_id?: string | null
          start_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_at?: string | null
          id?: string | null
          is_open?: boolean | null
          room_id?: string | null
          start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_apply_to: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
      cancel_booking: { Args: { _booking_id: string }; Returns: undefined }
      cancel_room_reservation: {
        Args: { p_reason: string; p_reservation_id: string }
        Returns: undefined
      }
      confirm_booking: { Args: { _booking_id: string }; Returns: Json }
      create_booking_hold: {
        Args: { _origin_application_id?: string; _slot_id: string }
        Returns: string
      }
      decide_booking_request: {
        Args: { _approve: boolean; _booking_id: string }
        Returns: undefined
      }
      expire_stale_holds: { Args: never; Returns: undefined }
      get_advanced_metrics: { Args: never; Returns: Json }
      get_hook_metrics: {
        Args: { days?: number }
        Returns: {
          applications: number
          community_posts: number
          day: string
          job_posts: number
          messages_sent: number
          new_conversations: number
          promotion_posts: number
          reservations: number
          room_posts: number
          signups: number
        }[]
      }
      get_hook_totals: { Args: never; Returns: Json }
      get_support_admin_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_accepted_applicant: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
      owns_room: { Args: { _room_id: string; _uid: string }; Returns: boolean }
      owns_room_post: {
        Args: { _post_id: string; _uid: string }
        Returns: boolean
      }
      owns_studio: {
        Args: { _studio_id: string; _uid: string }
        Returns: boolean
      }
      profile_is_eligible: { Args: { uid: string }; Returns: boolean }
      purge_expired_credentials: { Args: never; Returns: number }
      refresh_all_user_stats: { Args: never; Returns: undefined }
      refresh_user_stats: { Args: { uid: string }; Returns: undefined }
      resolve_rating_report: {
        Args: { p_decision: string; p_note?: string; p_report_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
