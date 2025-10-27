import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

export interface GitLabTokenAttributes {
  id: number;
  discord_id: string;
  encrypted_token: string;
  created_at: Date;
  updated_at: Date;
}

export interface GitLabTokenCreationAttributes extends Optional<GitLabTokenAttributes, 'id' | 'created_at' | 'updated_at'> {}

export class GitLabToken extends Model<GitLabTokenAttributes, GitLabTokenCreationAttributes> implements GitLabTokenAttributes {
  public id!: number;
  public discord_id!: string;
  public encrypted_token!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

GitLabToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    discord_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    encrypted_token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'gitlab_tokens',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['discord_id'],
      },
    ],
  }
);

