import { Directive, Input, TemplateRef, ViewContainerRef } from "@angular/core";

@Directive({
  // we want to keep ngVar so it looks like ngFor and others
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: "[ngVar]",
})
export class VarDirectiveDirective {
  @Input()
  set ngVar(context: unknown) {
    this.context.$implicit = this.context.ngVar = context;

    if (!this.hasView) {
      this.vcRef.createEmbeddedView(this.templateRef, this.context);
      this.hasView = true;
    }
  }

  private context: {
    $implicit: unknown;
    ngVar: unknown;
  } = {
    $implicit: null,
    ngVar: null,
  };

  private hasView: boolean = false;

  constructor(private templateRef: TemplateRef<any>, private vcRef: ViewContainerRef) {}
}
