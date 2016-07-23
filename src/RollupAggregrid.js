/**
 * TODO:
 * - [X] Set expander container height dynamically on expand
 * - [X] Make `expandable` a boolean config
 * - [X] Use mapper to collect subrows before expand
 * - [X] Render skeleton for real subrows before expand
 * - [X] Sync subrow heights before expand
 * - [ ] Continuously map subDataStore records to groups and render
 *
 * MAYBEDO:
 * - [ ] Move some of expander lifecycle up to base class
 */
Ext.define('Jarvus.aggregrid.RollupAggregrid', {
    extend: 'Jarvus.aggregrid.Aggregrid',
    xtype: 'jarvus-rollupaggregrid',


    config: {
        subRowsStore: null,
        subDataStore: null,

        parentRowMapper: 'parent_row_id',
        subRowMapper: 'sub_row_id',

        subRowHeaderField: 'title',
        subRowHeaderTpl: false,

        subCellTpl: '{records.length}',
        subCellRenderer: false,

        expandable: true,
        expanderHeadersTpl: [
            '<table class="jarvus-aggregrid-expander-table">',
                '<tbody>',
                    '<tpl for="subRows">',
                        '<tr class="jarvus-aggregrid-subrow" data-subrow-id="{id}">',
                            '<th class="jarvus-aggregrid-rowheader">',
                                '<span class="jarvus-aggregrid-header-text">',
                                    '{% values.rowHeaderTpl.applyOut(values, out, parent) %}',
                                '</span>',
                            '</th>',
                        '</tr>',
                    '</tpl>',
                '</tbody>',
            '</table>'
        ],
        expanderBodyTpl: [
            '<table class="jarvus-aggregrid-expander-table">',
                '<tbody>',
                    '<tpl for="subRows">',
                        '<tr class="jarvus-aggregrid-subrow" data-subrow-id="{id}">',
                            '<tpl for="columns">',
                                '<td class="jarvus-aggregrid-cell {cls}" data-column-id="{id}">{text}</td>',
                            '</tpl>',
                        '</tr>',
                    '</tpl>',
                '</tbody>',
            '</table>'
        ]
    },


    // config handlers
    applySubRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    // updateSubRowsStore: function(store, oldStore) {
    //     var me = this;

    //     if (oldStore) {
    //         oldStore.un('datachanged', 'refresh', me);
    //     }

    //     if (store) {
    //         me.refresh();
    //         store.on('datachanged', 'refresh', me);
    //     }
    // },

    applySubDataStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    // updateSubDataStore: function(store, oldStore) {
    //     var me = this,
    //         listeners = {
    //             scope: me,
    //             load: 'onDataStoreLoad',
    //             add: 'onDataStoreAdd',
    //             remove: 'onDataStoreRemove',
    //             update: 'onDataStoreUpdate'
    //         };

    //     if (oldStore) {
    //         oldStore.un(listeners);
    //     }

    //     if (store) {
    //         store.on(listeners);
    //     }
    // },

    applySubRowHeaderTpl: function(tpl) {
        if (!tpl) {
            tpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + this.getSubRowHeaderField() + '"]]}'
            );
        } else if (!tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyParentRowMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(subRowRecord, rowsStore) {
            return rowsStore.getById(subRowRecord.get(mapper));
        };
    },

    applySubRowMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(dataRecord, subRowsStore) {
            return subRowsStore.getById(dataRecord.get(mapper));
        };
    },

    applySubCellTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyExpanderHeadersTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyExpanderBodyTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },


    // event handlers


    // component methods
    doRefresh: function(me) {
        var rowsSubMetadata = me.rowsSubMetadata = {},
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            rowIndex = 0, row, rowId;

        me.callParent(arguments);

        // initialize subrows data structure
        for (; rowIndex < rowsCount; rowIndex++) {
            row = rowsStore.getAt(rowIndex);
            rowId = row.getId();

            rowsSubMetadata[rowId] = {
                row: row,
                rowId: rowId,
                subRows: [],
                groups: {}
            };
        }
    },

    doExpand: function(me, rowId) {
        console.info('%s.doExpand(%o)', this.getId(), rowId);

        var rowSubMetadata = me.rowsSubMetadata[rowId],
            expanderTplData = me.buildExpanderTplData(rowId);

        rowSubMetadata.headersEl = me.getExpanderHeadersTpl().overwrite(me.rowHeaderExpanderEls[rowId], expanderTplData, true);
        rowSubMetadata.bodyEl = me.getExpanderBodyTpl().overwrite(me.rowExpanderEls[rowId], expanderTplData, true);

        me.afterExpanderRefresh(rowId);

        me.callParent(arguments);
    },

    buildExpanderTplData: function(rowId) {
        var me = this,
            rowHeaderTpl = me.getSubRowHeaderTpl() || me.getRowHeaderTpl(),

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex = 0,

            subRows = me.getSubRows(rowId),
            subRowsCount = subRows.length,
            subRowIndex = 0,

            data = {},
            columnsData = data.columns = [],
            subRowsData = data.subRows = [];

        // generate columns and rows render data
        for (; columnIndex < columnsCount; columnIndex++) {
            columnsData.push(columnsStore.getAt(columnIndex).getData());
        }

        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRowsData.push(Ext.apply({
                rowHeaderTpl: rowHeaderTpl,
                columns: columnsData
            }, subRows[subRowIndex].getData()));
        }

        return data;
    },

    groupSubRows: function() {
        if (this.subRowParents) {
            return;
        }

        var me = this,
            rowsSubMetadata = me.rowsSubMetadata,
            subRowParents = me.subRowParents = {},

            rowsStore = me.getRowsStore(),
            subRowsStore = me.getSubRowsStore(),
            parentRowMapper = me.getParentRowMapper(),
            subRowsCount = subRowsStore.getCount(),
            subRowIndex = 0, subRow, parentRow;

        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRow = subRowsStore.getAt(subRowIndex);
            parentRow = parentRowMapper(subRow, rowsStore);

            subRowParents[subRow.getId()] = parentRow;
            rowsSubMetadata[parentRow.getId()].subRows.push(subRow);
        }
    },

    getSubRows: function(rowId) {
        this.groupSubRows();
        return this.rowsSubMetadata[rowId].subRows;
    },

    getParentRow: function(subRowId) {
        this.groupSubRows();
        return this.subRowParents[subRowId];
    },

    afterExpanderRefresh: function(rowId) {
        console.info('%s.afterExpanderRefresh(%o)', this.getId(), rowId);

        var me = this,
            rowSubMetadata = me.rowsSubMetadata[rowId],
            headersEl = rowSubMetadata.headersEl,
            bodyEl = rowSubMetadata.bodyEl,

            subRowEls = rowSubMetadata.subRowEls = {},
            subRowHeaderEls = rowSubMetadata.subRowHeaderEls = {},
            groups = rowSubMetadata.groups = {},

            subRows = rowSubMetadata.subRows,
            subRowsCount = subRows.length,
            subRowIndex = 0, subRow, subRowId, subRowGroups, subRowEl,

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex, column, columnId;

        // READ phase: query dom to collect references to key elements
        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRow = subRows[subRowIndex];
            subRowId = subRow.getId();
            subRowGroups = groups[subRowId] = {};

            subRowHeaderEls[subRowId] = headersEl.down('.jarvus-aggregrid-subrow[data-subrow-id="'+subRowId+'"]');
            subRowEl = subRowEls[subRowId] = bodyEl.down('.jarvus-aggregrid-subrow[data-subrow-id="'+subRowId+'"]');

            for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
                column = columnsStore.getAt(columnIndex);
                columnId = column.getId();

                subRowGroups[columnId] = {
                    records: [],
                    cellEl: subRowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]'),
                    row: subRow,
                    subRowId: subRowId,
                    column: column,
                    columnId: columnId
                };
            }
        }

        // READ->WRITE phase: sync row heights
        me.syncSubRowHeights(rowId);

        me.fireEvent('afterexpanderrefresh', me, rowId);
    },

    /**
     * @public
     * Synchronizes the heights of rows between the headers and data tables
     */
    syncSubRowHeights: function(rowId) {
        var me = this,
            rowSubMetadata = me.rowsSubMetadata[rowId],
            subRowEls = rowSubMetadata.subRowEls,
            subRowHeaderEls = rowSubMetadata.subRowHeaderEls,
            table1RowHeights = {},
            table2RowHeights = {},
            rowKey, maxHeight;

        Ext.batchLayouts(function() {
            // read all the row height in batch first for both tables
            for (rowKey in subRowHeaderEls) { // eslint-disable-line guard-for-in
                table1RowHeights[rowKey] = subRowHeaderEls[rowKey].getHeight();
                table2RowHeights[rowKey] = subRowEls[rowKey].getHeight();
            }

            // write all the max row heights
            for (rowKey in subRowHeaderEls) { // eslint-disable-line guard-for-in
                maxHeight = Math.max(table1RowHeights[rowKey], table2RowHeights[rowKey]);
                subRowHeaderEls[rowKey].select('td, th').setHeight(maxHeight);
                subRowEls[rowKey].select('td, th').setHeight(maxHeight);
            }
        });
    }
});