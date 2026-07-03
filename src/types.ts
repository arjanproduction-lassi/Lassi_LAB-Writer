export type SparkTemperature = "spark";

export interface Spark {
  id: string;
  title?: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  temperature: SparkTemperature;
  tags: string[];
  schemaVersion: 1;
}

export interface SparkInput {
  id?: string;
  title?: string;
  text: string;
}
