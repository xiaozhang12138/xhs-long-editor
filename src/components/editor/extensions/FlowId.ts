import { Extension } from '@tiptap/core';

/**
 * Preserve the stable block id used by the paginated editing projection.
 * IDs are assigned when entering the format stage and when a card edit
 * creates a new block; this extension keeps them intact when the document is
 * opened again in the main TipTap editor.
 */
export const FlowId = Extension.create({
  name: 'flowId',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'blockquote',
          'listItem',
          'image',
          'horizontalRule',
        ],
        attributes: {
          flowId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-flow-id'),
            renderHTML: (attributes) =>
              attributes.flowId
                ? { 'data-flow-id': String(attributes.flowId) }
                : {},
          },
        },
      },
    ];
  },
});

export default FlowId;
