/** @jsx etch.dom */
const etch = require("@lumine-code/etch");
const dedent = require("dedent");
const CodeBlock = require("./code-block");

module.exports = class DataTableExample {
  constructor({ onDidInitialize } = {}) {
    this.destroyed = false;
    this.sortBy = "name";
    this.sortDirection = "ascending";
    this.markup = dedent`
      <table class="data-table" aria-label="Example tasks">
        <thead>
          <tr>
            <th scope="col" aria-sort="ascending" data-column="name">
              <button type="button" class="data-table-sort native-key-bindings">
                <span class="data-table-sort-label">Name</span>
              </button>
            </th>
            <th scope="col" aria-sort="none" data-column="duration">
              <button type="button" class="data-table-sort native-key-bindings">
                <span class="data-table-sort-label">Duration (ms)</span>
              </button>
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr class="data-table-row current" tabindex="0" aria-current="true" data-name="Compile" data-duration="120">
            <td>Compile</td><td>120</td><td>Passed</td>
          </tr>
          <tr class="data-table-row" tabindex="0" data-name="Package" data-duration="45">
            <td>Package</td><td>45</td><td>Passed</td>
          </tr>
          <tr class="data-table-row" tabindex="0" data-name="Test" data-duration="8">
            <td>Test</td><td>8</td><td>Failed</td>
          </tr>
        </tbody>
      </table>
    `;
    this.code = dedent`
      const table = preview.querySelector('.data-table')
      let sortBy = 'name'
      let direction = 'ascending'
      for (const header of table.querySelectorAll('th[data-column]')) {
        header.querySelector('button').addEventListener('click', () => {
          const key = header.dataset.column
          direction = sortBy === key && direction === 'ascending'
            ? 'descending' : 'ascending'
          sortBy = key
          const sign = direction === 'ascending' ? 1 : -1
          const rows = [...table.tBodies[0].rows]
          rows.sort((left, right) => sign * (key === 'duration'
            ? Number(left.dataset.duration) - Number(right.dataset.duration)
            : left.dataset.name.localeCompare(right.dataset.name)))
          for (const row of rows) table.tBodies[0].append(row)
          for (const column of table.querySelectorAll('th[data-column]')) {
            column.setAttribute('aria-sort', column === header ? direction : 'none')
          }
        })
      }
    `;
    etch.initialize(this);
    this.refs.preview.innerHTML = this.markup;
    this.table = this.refs.preview.querySelector("table");
    this.headers = new Map();
    for (const cell of this.table.querySelectorAll("th[data-column]")) {
      const key = cell.dataset.column;
      const button = cell.querySelector("button");
      button.addEventListener("click", () => this.sort(key));
      this.headers.set(key, { cell, button });
    }
    this.rows = [...this.table.tBodies[0].rows];
    for (const row of this.rows) {
      row.addEventListener("focusin", () => row.classList.add("focused"));
      row.addEventListener("focusout", () => row.classList.remove("focused"));
    }
    onDidInitialize?.(this);
  }

  sort(key) {
    if (this.destroyed || !this.headers.has(key)) return;
    this.sortDirection =
      this.sortBy === key && this.sortDirection === "ascending" ? "descending" : "ascending";
    this.sortBy = key;
    const sign = this.sortDirection === "ascending" ? 1 : -1;
    this.rows.sort(
      (left, right) =>
        sign *
        (key === "duration"
          ? Number(left.dataset.duration) - Number(right.dataset.duration)
          : left.dataset.name.localeCompare(right.dataset.name)),
    );
    for (const row of this.rows) this.table.tBodies[0].append(row);
    for (const [column, { cell }] of this.headers)
      cell.setAttribute("aria-sort", column === key ? this.sortDirection : "none");
  }

  render() {
    return (
      <div className="example">
        <div className="example-rendered" ref="preview" />
        <div className="example-code">
          <CodeBlock
            cssClass="example-html"
            grammarScopeName="text.html.basic"
            code={this.markup}
          />
          <CodeBlock cssClass="example-js" grammarScopeName="source.js" code={this.code} />
        </div>
      </div>
    );
  }

  update() {
    return Promise.resolve();
  }

  destroy() {
    if (this.destroyed) return this.destroyPromise;
    this.destroyed = true;
    this.destroyPromise = etch.destroy(this);
    return this.destroyPromise;
  }
};
