/**
 * The template-facing props of every framework element, generated
 * from the primitives by scripts/gen-prop-table (see the catalog).
 * Do not edit by hand: a test re-derives this table from
 * packages/ui/src/primitives.tsx and fails when the two disagree.
 * Event props (onPress, onChange, ...) are absent on purpose: they
 * reach the element through event bindings, not attributes.
 */
export const ELEMENT_PROPS: Record<string, string[]> = {
  'accordion': ['style'],
  'actions': ['style'],
  'appbar': ['actionIcon', 'actionIcon2', 'avatar', 'back', 'menu', 'pin', 'progress', 'search', 'title', 'titleAlign', 'tone'],
  'avatar': ['size', 'src', 'style', 'text'],
  'avatar-group': ['max', 'style'],
  'bottom-nav': ['haptic', 'index', 'style'],
  'breadcrumbs': ['style'],
  'button': ['badge', 'color', 'disabled', 'style', 'tooltip', 'variant'],
  'calendar': ['style', 'value'],
  'card': ['style'],
  'carousel': ['index', 'style'],
  'chart': ['data', 'height', 'style', 'type', 'width'],
  'checkbox': ['checked', 'disabled', 'style'],
  'chip': ['icon', 'removable', 'style'],
  'chips': ['style'],
  'code': ['style'],
  'color-picker': ['disabled', 'label', 'placeholder', 'style', 'value'],
  'column': ['header', 'name', 'sortable'],
  'crumb': [],
  'datetime-picker': ['label', 'minuteInterval', 'mode', 'style', 'value'],
  'dialog': ['open', 'style', 'title'],
  'div': ['icon', 'label', 'meta', 'plain', 'style'],
  'divider': ['style'],
  'drawer': ['open', 'style'],
  'editor': ['disabled', 'label', 'placeholder', 'style', 'value'],
  'empty-state': ['icon', 'style', 'text', 'title'],
  'fab': ['label'],
  'file-picker': ['disabled', 'kind', 'label', 'multiple', 'placeholder', 'style'],
  'form': ['icon', 'label', 'meta', 'plain', 'style'],
  'gradient': ['style'],
  'grid-list': ['cols', 'mode', 'style'],
  'grid-tile': ['__widthPct', 'style'],
  'h1': ['style', 'variant'],
  'h2': ['style', 'variant'],
  'h3': ['style', 'variant'],
  'header': ['icon', 'label', 'meta', 'plain', 'style'],
  'icon': ['badge', 'color', 'name', 'size', 'style'],
  'icon-button': ['color', 'name', 'size', 'style', 'tooltip'],
  'image': ['height', 'resize', 'src', 'style', 'width'],
  'input': ['avatarText', 'disabled', 'error', 'keyboardType', 'label', 'leadingIcon', 'mask', 'options', 'pillTone', 'placeholder', 'secure', 'style', 'value', 'variant'],
  'label': ['style', 'variant'],
  'lightbox': ['open', 'src', 'style'],
  'list': ['data', 'haptic', 'keyExtractor', 'refreshing', 'renderItem'],
  'menu': ['open', 'style'],
  'menu-item': ['disabled', 'icon', 'style'],
  'nav-item': ['badge', 'icon', 'label'],
  'option': ['value'],
  'otp': ['disabled', 'length', 'style', 'value'],
  'p': ['style', 'variant'],
  'panel': ['__groupExpanded', '__groupToggle', 'expanded', 'style', 'subtitle', 'title'],
  'progress-bar': ['mode', 'style', 'value'],
  'radio': ['value'],
  'radio-group': ['disabled', 'style', 'value'],
  'rating': ['disabled', 'max', 'style', 'value'],
  'router-outlet': [],
  'row': ['actionIcon', 'avatar', 'avatarText', 'avatarTone', 'badge', 'detail', 'icon', 'lastInList', 'selected', 'subtitle', 'time', 'title', 'tooltip'],
  'row-action': ['color', 'icon', 'label'],
  'screen': ['fade', 'haptic', 'refreshing', 'scrollKey', 'style', 'theme'],
  'section': ['icon', 'label', 'meta', 'plain', 'style'],
  'select': ['disabled', 'label', 'placeholder', 'style', 'value'],
  'sheet': ['open', 'style'],
  'skeleton': ['height', 'shape', 'size', 'style', 'width'],
  'slider': ['disabled', 'max', 'min', 'step', 'style', 'value'],
  'spinner': ['color', 'size', 'style'],
  'step': ['label'],
  'stepper': ['index', 'style'],
  'switch': ['checked', 'color', 'disabled', 'haptic', 'style'],
  'switcher': ['disabled', 'style', 'value'],
  'tab': ['label'],
  'table': ['data', 'emptyText', 'pageSize', 'style'],
  'tabs': ['index', 'style'],
  'timeline': ['style'],
  'timeline-item': ['__last', 'style', 'time', 'title'],
  'tree': ['style'],
  'tree-node': ['expanded', 'label', 'style'],
};

/** Attributes the compiler itself consumes, valid on any element. */
export const GLOBAL_ATTRS: string[] = ['class', 'id'];

/** Names codegen consumes specially, per the forms and routing passes. */
export const CODEGEN_ATTRS: string[] = ['formControlName', 'formGroup', 'formGroupName', 'formArrayName', 'ngModel', 'routerLink'];

/**
 * Names codegen consumes per element, hand-kept because each is read
 * from the attributes by a specific pass (the forms pass reads the
 * validator attributes and ngModelOptions on <input>; the submit pass
 * reads type on <button>; the table pass reads key on <column> as the
 * alias of its name). Each entry traces to a read in generate.ts or
 * template/forms.ts.
 */
export const ELEMENT_EXTRA_PROPS: Record<string, string[]> = {
  button: ['type'],
  input: ['type', 'required', 'minlength', 'maxlength', 'pattern', 'email', 'ngModelOptions'],
  textarea: ['required', 'minlength', 'maxlength'],
  select: ['required'],
  column: ['key'],
};
