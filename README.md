# styleguide

A visual styleguide of the editor's UI components.

Fork of [pulsar-edit/pulsar](https://github.com/pulsar-edit/pulsar) (`packages/styleguide`).

## Features

- **Component reference**: shows controls, lists, panels, menus, tooltips and icons.
- **Theme variables**: separates color swatches from other values and keeps them current with the active theme.
- **Interactive examples**: demonstrates input validation, selection, popup menus and tooltips through the editor's shared APIs.
- **Theme and package aid**: acts as a reference while developing themes and packages.
- **Collapsible sections**: expand or collapse sections with their heading buttons, or use the controls at the top.

## Installation

To install `styleguide` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/styleguide`.

## Commands

Commands available in `lumine-workspace`:

- `styleguide:show`: open the styleguide in a new tab.

## Customization

Tweak the styleguide layout by adding CSS to your `styles.css`:

```css
.styleguide {
  padding: 20px;
  font-size: 14px;
}
```

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
