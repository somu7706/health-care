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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      care_plans: {
        Row: {
          created_at: string | null
          disease: string | null
          id: string
          plan: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          disease?: string | null
          id?: string
          plan?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          disease?: string | null
          id?: string
          plan?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      disease_stages: {
        Row: {
          confidence: number | null
          created_at: string | null
          disease: string
          id: string
          stage: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          disease: string
          id?: string
          stage?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          disease?: string
          id?: string
          stage?: string | null
          user_id?: string
        }
        Relationships: []
      }
      health_profiles: {
        Row: {
          care_plan: Json | null
          created_at: string | null
          diet_plan: Json | null
          disease: string | null
          id: string
          last_updated: string | null
          medicines: Json | null
          precautions: Json | null
          stage: string | null
          stage_confidence: number | null
          summary: string | null
          user_id: string
        }
        Insert: {
          care_plan?: Json | null
          created_at?: string | null
          diet_plan?: Json | null
          disease?: string | null
          id?: string
          last_updated?: string | null
          medicines?: Json | null
          precautions?: Json | null
          stage?: string | null
          stage_confidence?: number | null
          summary?: string | null
          user_id: string
        }
        Update: {
          care_plan?: Json | null
          created_at?: string | null
          diet_plan?: Json | null
          disease?: string | null
          id?: string
          last_updated?: string | null
          medicines?: Json | null
          precautions?: Json | null
          stage?: string | null
          stage_confidence?: number | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medical_reports: {
        Row: {
          created_at: string | null
          file_url: string | null
          id: string
          report_text: string | null
          report_type: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          report_text?: string | null
          report_type?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          report_text?: string | null
          report_type?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medicines: {
        Row: {
          created_at: string | null
          dosage: string | null
          duration: string | null
          frequency: string | null
          id: string
          name: string
          source_report: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          name: string
          source_report?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          name?: string
          source_report?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          schedule_time: string | null
          status: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          schedule_time?: string | null
          status?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          schedule_time?: string | null
          status?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      precautions: {
        Row: {
          created_at: string | null
          disease: string | null
          id: string
          precaution: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          disease?: string | null
          id?: string
          precaution: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          disease?: string | null
          id?: string
          precaution?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          location: string | null
          name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          location?: string | null
          name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          location?: string | null
          name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          id: string
          message: string
          scheduled_time: string
          source: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          scheduled_time?: string
          source?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          scheduled_time?: string
          source?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      symptoms: {
        Row: {
          created_at: string | null
          id: string
          symptom: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          symptom: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          symptom?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_connections: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          scopes: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wearable_health_data: {
        Row: {
          calories: number | null
          created_at: string | null
          distance: number | null
          heart_rate: number | null
          id: string
          recorded_at: string | null
          sleep_hours: number | null
          source: string | null
          steps: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          created_at?: string | null
          distance?: number | null
          heart_rate?: number | null
          id?: string
          recorded_at?: string | null
          sleep_hours?: number | null
          source?: string | null
          steps?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          created_at?: string | null
          distance?: number | null
          heart_rate?: number | null
          id?: string
          recorded_at?: string | null
          sleep_hours?: number | null
          source?: string | null
          steps?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
