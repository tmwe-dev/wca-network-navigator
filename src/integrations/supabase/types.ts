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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      interactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          interaction_date: string | null
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          notes: string | null
          partner_id: string
          subject: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          interaction_date?: string | null
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          notes?: string | null
          partner_id: string
          subject: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          interaction_date?: string | null
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          notes?: string | null
          partner_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_certifications: {
        Row: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at: string | null
          id: string
          partner_id: string
        }
        Insert: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          partner_id: string
        }
        Update: {
          certification?: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_certifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          created_at: string | null
          direct_phone: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          name: string
          partner_id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name: string
          partner_id: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name?: string
          partner_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_networks: {
        Row: {
          created_at: string | null
          expires: string | null
          id: string
          network_id: string | null
          network_name: string
          partner_id: string
        }
        Insert: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name: string
          partner_id: string
        }
        Update: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_networks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_services: {
        Row: {
          created_at: string | null
          id: string
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_id?: string
          service_category?: Database["public"]["Enums"]["service_category"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          branch_cities: Json | null
          city: string
          company_name: string
          country_code: string
          country_name: string
          created_at: string | null
          email: string | null
          emergency_phone: string | null
          fax: string | null
          has_branches: boolean | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          member_since: string | null
          membership_expires: string | null
          mobile: string | null
          office_type: Database["public"]["Enums"]["office_type"] | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          phone: string | null
          profile_description: string | null
          rating: number | null
          rating_details: Json | null
          updated_at: string | null
          wca_id: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          branch_cities?: Json | null
          city: string
          company_name: string
          country_code: string
          country_name: string
          created_at?: string | null
          email?: string | null
          emergency_phone?: string | null
          fax?: string | null
          has_branches?: boolean | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          updated_at?: string | null
          wca_id?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          branch_cities?: Json | null
          city?: string
          company_name?: string
          country_code?: string
          country_name?: string
          created_at?: string | null
          email?: string | null
          emergency_phone?: string | null
          fax?: string | null
          has_branches?: boolean | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          updated_at?: string | null
          wca_id?: number | null
          website?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          partner_id: string
          priority: Database["public"]["Enums"]["reminder_priority"] | null
          status: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          partner_id: string
          priority?: Database["public"]["Enums"]["reminder_priority"] | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          partner_id?: string
          priority?: Database["public"]["Enums"]["reminder_priority"] | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      certification_type: "IATA" | "BASC" | "ISO" | "C-TPAT" | "AEO"
      interaction_type: "call" | "email" | "meeting" | "note"
      office_type: "head_office" | "branch"
      partner_type:
        | "freight_forwarder"
        | "customs_broker"
        | "carrier"
        | "nvocc"
        | "3pl"
        | "courier"
      reminder_priority: "low" | "medium" | "high"
      reminder_status: "pending" | "completed"
      service_category:
        | "air_freight"
        | "ocean_fcl"
        | "ocean_lcl"
        | "road_freight"
        | "rail_freight"
        | "project_cargo"
        | "dangerous_goods"
        | "perishables"
        | "pharma"
        | "ecommerce"
        | "relocations"
        | "customs_broker"
        | "warehousing"
        | "nvocc"
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
      certification_type: ["IATA", "BASC", "ISO", "C-TPAT", "AEO"],
      interaction_type: ["call", "email", "meeting", "note"],
      office_type: ["head_office", "branch"],
      partner_type: [
        "freight_forwarder",
        "customs_broker",
        "carrier",
        "nvocc",
        "3pl",
        "courier",
      ],
      reminder_priority: ["low", "medium", "high"],
      reminder_status: ["pending", "completed"],
      service_category: [
        "air_freight",
        "ocean_fcl",
        "ocean_lcl",
        "road_freight",
        "rail_freight",
        "project_cargo",
        "dangerous_goods",
        "perishables",
        "pharma",
        "ecommerce",
        "relocations",
        "customs_broker",
        "warehousing",
        "nvocc",
      ],
    },
  },
} as const
