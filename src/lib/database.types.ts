// Generated from the Supabase project schema (color-hunt-game). Regenerate after migrations.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      game_sessions: {
        Row: {
          code: string
          created_at: string
          current_round_id: string | null
          host_id: string
          hunter_id: string | null
          id: string
          max_players: number
          round_number: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_round_id?: string | null
          host_id: string
          hunter_id?: string | null
          id?: string
          max_players?: number
          round_number?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_round_id?: string | null
          host_id?: string
          hunter_id?: string | null
          id?: string
          max_players?: number
          round_number?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_current_round_fk"
            columns: ["current_round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      map_objects: {
        Row: {
          id: string
          kind: string
          weight: number
          x: number
          z: number
        }
        Insert: {
          id: string
          kind: string
          weight?: number
          x: number
          z: number
        }
        Update: {
          id?: string
          kind?: string
          weight?: number
          x?: number
          z?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          caught_player_id: string | null
          color_hex: string
          color_name: string
          end_reason: Database["public"]["Enums"]["round_end_reason"] | null
          ended_at: string | null
          ends_at: string
          hidden_object_id: string
          hunter_id: string
          id: string
          next_hunter_id: string | null
          round_number: number
          session_id: string
          started_at: string
        }
        Insert: {
          caught_player_id?: string | null
          color_hex: string
          color_name: string
          end_reason?: Database["public"]["Enums"]["round_end_reason"] | null
          ended_at?: string | null
          ends_at: string
          hidden_object_id: string
          hunter_id: string
          id?: string
          next_hunter_id?: string | null
          round_number: number
          session_id: string
          started_at?: string
        }
        Update: {
          caught_player_id?: string | null
          color_hex?: string
          color_name?: string
          end_reason?: Database["public"]["Enums"]["round_end_reason"] | null
          ended_at?: string | null
          ends_at?: string
          hidden_object_id?: string
          hunter_id?: string
          id?: string
          next_hunter_id?: string | null
          round_number?: number
          session_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_hidden_object_id_fkey"
            columns: ["hidden_object_id"]
            isOneToOne: false
            referencedRelation: "map_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_players: {
        Row: {
          color_index: number
          display_name: string
          joined_at: string
          last_seen_at: string
          session_id: string
          status: Database["public"]["Enums"]["player_status"]
          user_id: string
        }
        Insert: {
          color_index: number
          display_name: string
          joined_at?: string
          last_seen_at?: string
          session_id: string
          status?: Database["public"]["Enums"]["player_status"]
          user_id: string
        }
        Update: {
          color_index?: number
          display_name?: string
          joined_at?: string
          last_seen_at?: string
          session_id?: string
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_player_count: { Args: { p_session_id: string }; Returns: number }
      announce_color: {
        Args: {
          p_color_hex: string
          p_color_name: string
          p_positions: Json
          p_session_id: string
        }
        Returns: {
          caught_player_id: string | null
          color_hex: string
          color_name: string
          end_reason: Database["public"]["Enums"]["round_end_reason"] | null
          ended_at: string | null
          ends_at: string
          hidden_object_id: string
          hunter_id: string
          id: string
          next_hunter_id: string | null
          round_number: number
          session_id: string
          started_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      catch_player: {
        Args: { p_session_id: string; p_target_id: string }
        Returns: Json
      }
      claim_safe: {
        Args: { p_object_id: string; p_session_id: string }
        Returns: Json
      }
      create_session: {
        Args: never
        Returns: {
          code: string
          created_at: string
          current_round_id: string | null
          host_id: string
          hunter_id: string | null
          id: string
          max_players: number
          round_number: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "game_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_round: {
        Args: {
          p_caught_player_id: string
          p_next_hunter_id: string
          p_reason: Database["public"]["Enums"]["round_end_reason"]
          p_session_id: string
        }
        Returns: undefined
      }
      expire_round: { Args: { p_session_id: string }; Returns: boolean }
      generate_session_code: { Args: never; Returns: string }
      get_session_snapshot: { Args: { p_session_id: string }; Returns: Json }
      heartbeat: { Args: { p_session_id: string }; Returns: undefined }
      is_session_member: { Args: { p_session_id: string }; Returns: boolean }
      join_session: {
        Args: { p_code: string }
        Returns: {
          code: string
          created_at: string
          current_round_id: string | null
          host_id: string
          hunter_id: string | null
          id: string
          max_players: number
          round_number: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "game_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_session: { Args: { p_session_id: string }; Returns: undefined }
      lock_session: {
        Args: { p_session_id: string }
        Returns: {
          code: string
          created_at: string
          current_round_id: string | null
          host_id: string
          hunter_id: string | null
          id: string
          max_players: number
          round_number: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "game_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_stale_players: { Args: { p_session_id: string }; Returns: number }
      next_round: { Args: { p_session_id: string }; Returns: undefined }
      pick_hidden_object: {
        Args: { p_positions: Json; p_session_id: string }
        Returns: string
      }
      pick_random_active_player: {
        Args: { p_exclude?: string; p_session_id: string }
        Returns: string
      }
      remove_player: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      require_user: { Args: never; Returns: string }
      session_id_from_topic: { Args: { p_topic: string }; Returns: string }
      start_game: { Args: { p_session_id: string }; Returns: undefined }
      transfer_host_if_needed: {
        Args: { p_session_id: string }
        Returns: undefined
      }
    }
    Enums: {
      player_status:
        | "waiting"
        | "searching"
        | "safe"
        | "hunter"
        | "eliminated"
        | "left"
      round_end_reason: "caught" | "all_safe" | "timeout" | "hunter_left"
      session_status:
        | "lobby"
        | "choosing_color"
        | "hunting"
        | "round_over"
        | "finished"
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

export const Constants = {
  public: {
    Enums: {
      player_status: [
        "waiting",
        "searching",
        "safe",
        "hunter",
        "eliminated",
        "left",
      ],
      round_end_reason: ["caught", "all_safe", "timeout", "hunter_left"],
      session_status: [
        "lobby",
        "choosing_color",
        "hunting",
        "round_over",
        "finished",
      ],
    },
  },
} as const
