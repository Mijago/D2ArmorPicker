import { Pipe, PipeTransform } from "@angular/core";
import { DatabaseService } from "src/app/services/database.service";

@Pipe({
  name: "getVendorName",
  pure: true,
})
export class VendorNamePipe implements PipeTransform {
  constructor(private database: DatabaseService) {}

  async transform(value: number): Promise<string> {
    const vendor = await this.database.vendorNames.where("vendorId").equals(value).first();
    return vendor?.vendorName ?? "Unknown Vendor";
  }
}

@Pipe({
  name: "getVendorIdFromItemId",
  pure: true,
})
export class VendorIdFromItemIdPipe implements PipeTransform {
  constructor() {}

  transform(value: string): number {
    if (!value || !value.startsWith("v")) return -1;
    const vendorId = parseInt(value.substring(1).split("-")[0]);
    if (isNaN(vendorId)) return -1;
    return vendorId;
  }
}
