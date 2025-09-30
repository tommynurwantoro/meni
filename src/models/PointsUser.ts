import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

export interface PointsUserAttributes {
  id: number;
  discord_id: string;
  guild_id: string;
  points: number;
  total_received: number;
  total_given: number;
  last_active: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PointsUserCreationAttributes extends Optional<PointsUserAttributes, 'id' | 'points' | 'total_received' | 'total_given' | 'last_active' | 'created_at' | 'updated_at'> {}

export class PointsUser extends Model<PointsUserAttributes, PointsUserCreationAttributes> implements PointsUserAttributes {
  public id!: number;
  public discord_id!: string;
  public guild_id!: string;
  public points!: number;
  public total_received!: number;
  public total_given!: number;
  public last_active!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PointsUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    discord_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guild_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    total_received: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    total_given: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    last_active: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
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
    tableName: 'points_users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['discord_id', 'guild_id'],
      },
      {
        fields: ['guild_id'],
      },
      {
        fields: ['points'],
      },
    ],
  }
);
