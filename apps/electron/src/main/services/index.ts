import { createServices } from "electron-ipc-decorator";
import { AiService } from "./AiService";
import { AssetService } from "./AssetService";
import { CategoryService } from "./CategoryService";
import { ConfigService } from "./ConfigService";
import { ContextService } from "./ContextService";
import { SearchService } from "./SearchService";
import { ThoughtService } from "./ThoughtService";
import { TrashService } from "./TrashService";

export const services = createServices([
  AiService,
  AssetService,
  CategoryService,
  ConfigService,
  ThoughtService,
  ContextService,
  SearchService,
  TrashService,
]);
