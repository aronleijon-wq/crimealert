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
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "incident_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          area: string | null
          category: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          lat: number | null
          lng: number | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          area?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          area?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          read: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          read?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          read?: boolean
        }
        Relationships: []
      }
      external_events: {
        Row: {
          area: string | null
          category: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_credit: string | null
          image_url: string | null
          kind: string
          lat: number | null
          lng: number | null
          published_at: string
          severity: string
          source: string
          summary: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          area?: string | null
          category?: string | null
          created_at?: string
          ends_at?: string | null
          id: string
          image_credit?: string | null
          image_url?: string | null
          kind: string
          lat?: number | null
          lng?: number | null
          published_at: string
          severity?: string
          source: string
          summary?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          area?: string | null
          category?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_credit?: string | null
          image_url?: string | null
          kind?: string
          lat?: number | null
          lng?: number | null
          published_at?: string
          severity?: string
          source?: string
          summary?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          precision: string
          query: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          precision?: string
          query: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          precision?: string
          query?: string
        }
        Relationships: []
      }
      incident_comments: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_reactions: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ingest_state: {
        Row: {
          key: string
          last_run_at: string
        }
        Insert: {
          key: string
          last_run_at?: string
        }
        Update: {
          key?: string
          last_run_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          kommun: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kommun: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kommun?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          min_risk: string
          types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          min_risk?: string
          types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          min_risk?: string
          types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      police_events_archive: {
        Row: {
          area: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          location_precision: string | null
          original_type: string | null
          risk: string | null
          source: string | null
          status: string | null
          time: string
          title: string
          type: string
          url: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          description?: string | null
          id: string
          lat?: number | null
          lng?: number | null
          location_precision?: string | null
          original_type?: string | null
          risk?: string | null
          source?: string | null
          status?: string | null
          time: string
          title: string
          type: string
          url?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_precision?: string | null
          original_type?: string | null
          risk?: string | null
          source?: string | null
          status?: string | null
          time?: string
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cookie_consent: boolean
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          cookie_consent?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          cookie_consent?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          display_name: string
          id: string
          message: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          message: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          message?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      sent_push_log: {
        Row: {
          event_id: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      community_reports_public: {
        Row: {
          area: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          lat: number | null
          lng: number | null
          status: string | null
          title: string | null
        }
        Insert: {
          area?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          status?: string | null
          title?: string | null
        }
        Update: {
          area?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      reviews_public: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string | null
          message: string | null
          rating: number | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          message?: string | null
          rating?: number | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          message?: string | null
          rating?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      app_role: ["admin", "user"],
    },
  },
} as const
