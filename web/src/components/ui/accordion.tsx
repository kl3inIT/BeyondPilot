import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "cn";
import { ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon } from "lucide-react";

/**
 * `lg` is the marketing FAQ size from the Figma landing: 18px questions with a plus or minus, 16px muted
 * answers, a rule above every item and one below the list.
 */
function Accordion({
  className,
  size = "default",
  ...props
}: AccordionPrimitive.Root.Props & { size?: "default" | "lg" }) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      data-size={size}
      className={cn("group/accordion flex w-full flex-col data-[size=lg]:border-b", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "not-last:border-b group-data-[size=lg]/accordion:border-t group-data-[size=lg]/accordion:not-last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none group-data-[size=lg]/accordion:gap-6 group-data-[size=lg]/accordion:py-6 group-data-[size=lg]/accordion:text-lg group-data-[size=lg]/accordion:font-semibold hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[size=lg]/accordion:aria-expanded:pb-3 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground group-data-[size=lg]/accordion:**:data-[slot=accordion-trigger-icon]:size-5 group-data-[size=lg]/accordion:**:data-[slot=accordion-trigger-icon]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-data-[size=default]/accordion:inline group-data-[size=default]/accordion:group-aria-expanded/accordion-trigger:hidden"
        />
        <ChevronUpIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-data-[size=default]/accordion:group-aria-expanded/accordion-trigger:inline"
        />
        <PlusIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-data-[size=lg]/accordion:inline group-data-[size=lg]/accordion:group-aria-expanded/accordion-trigger:hidden"
        />
        <MinusIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-data-[size=lg]/accordion:group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm group-data-[size=lg]/accordion:text-base group-data-[size=lg]/accordion:text-muted-foreground data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-2.5 group-data-[size=lg]/accordion:pb-6 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
