import {
  cloneElement,
  useId,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement
} from 'react';

type TooltipChildProps = {
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  'aria-describedby'?: string;
};

export function Tooltip({
  label,
  children
}: {
  label: string;
  children: ReactElement<TooltipChildProps>;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const describedBy = open ? id : undefined;

  return (
    <span className="tooltip">
      {cloneElement(children, {
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          children.props.onMouseEnter?.(event);
          setOpen(true);
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          children.props.onMouseLeave?.(event);
          setOpen(false);
        },
        onFocus: (event: FocusEvent<HTMLElement>) => {
          children.props.onFocus?.(event);
          setOpen(true);
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          children.props.onBlur?.(event);
          setOpen(false);
        }
      })}
      <span id={id} role="tooltip" className="tooltip__bubble" hidden={!open}>
        {label}
      </span>
    </span>
  );
}
