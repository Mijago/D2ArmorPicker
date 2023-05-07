import {
  Directive,
  Input,
  TemplateRef,
  ElementRef,
  OnInit,
  HostListener,
  ComponentRef,
  OnDestroy,
} from "@angular/core";
import { Overlay, OverlayPositionBuilder, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { IManifestArmor } from "../../../../data/types/IManifestArmor";
import { Modifier } from "../../../../data/modifier";
import { ModDescriptionTooltipComponent } from "./mod-description-tooltip.component";

@Directive({
  selector: "[modTooltip]",
})
export class ModTooltipDirective implements OnInit, OnDestroy {
  //If this is specified then specified text will be show in in the tooltip
  @Input(`modTooltip`) mod: Modifier | undefined;

  private _overlayRef: OverlayRef | undefined;

  constructor(
    private _overlay: Overlay,
    private _overlayPositionBuilder: OverlayPositionBuilder,
    private _elementRef: ElementRef
  ) {}

  /**
   * Init life cycle event handler
   */
  ngOnInit() {
    const positionStrategy = this._overlayPositionBuilder
      .flexibleConnectedTo(this._elementRef)
      .withPositions([
        {
          originX: "center",
          originY: "bottom",
          overlayX: "center",
          overlayY: "top",
          offsetY: 5,
        },
        {
          originX: "center",
          originY: "top",
          overlayX: "center",
          overlayY: "bottom",
          offsetY: -5,
        },
      ]);

    this._overlayRef = this._overlay.create({ positionStrategy });
    this._overlayRef.addPanelClass("overlay-no-pointer-event");
  }

  /**
   * This method will be called whenever mouse enters in the Host element
   * i.e. where this directive is applied
   * This method will show the tooltip by instantiating the McToolTipComponent and attaching to the overlay
   */
  @HostListener("mouseenter")
  show() {
    //attach the component if it has not already attached to the overlay
    if (this._overlayRef && !this._overlayRef.hasAttached()) {
      const tooltipRef: ComponentRef<ModDescriptionTooltipComponent> = this._overlayRef.attach(
        new ComponentPortal(ModDescriptionTooltipComponent)
      );
      tooltipRef.instance.mod = this.mod;
    }
  }

  /**
   * This method will be called when mouse goes out of the host element
   * i.e. where this directive is applied
   * This method will close the tooltip by detaching the overlay from the view
   */
  @HostListener("mouseleave")
  hide() {
    this.closeToolTip();
  }

  /**
   * Destroy lifecycle event handler
   * This method will make sure to close the tooltip
   * It will be needed in case when app is navigating to different page
   * and user is still seeing the tooltip; In that case we do not want to hang around the
   * tooltip after the page [on which tooltip visible] is destroyed
   */
  ngOnDestroy() {
    this.closeToolTip();
  }

  /**
   * This method will close the tooltip by detaching the component from the overlay
   */
  private closeToolTip() {
    if (this._overlayRef) {
      this._overlayRef.detach();
    }
  }
}
