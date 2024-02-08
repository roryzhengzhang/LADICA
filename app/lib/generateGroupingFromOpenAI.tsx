//this method is used to classify different notes according to the dimensions, not the relationship between different notes

import { Editor, TLShapeId, createShapeId } from '@tldraw/tldraw'
import { TLFrameShape } from '@tldraw/editor'
import { ResponseShape } from '../ResponseShape/ResponseShape'
import { getSelectionAsImageDataUrl } from './getSelectionAsImageDataUrl'
import {
	GPT4CompletionResponse,
	GPT4Message,
	MessageContent,
	fetchFromOpenAi,
} from './fetchFromOpenAi'

// the system prompt explains to gpt-4 what we want it to do and how it should behave.
const systemPrompt = `Imagine you are the GPT-4 model, designed to assist a team in brainstorming sessions. During the session, the team may want to group different ideas from notes according to some dimensions. \
Your need to analyze all notes first, and then group them into differnt classes according to the specified dimensions. The notes in the same class should share similar property, and the class name is the same as the shared property. It is possible that one note can appear in different classes. The property should be insightful enough to contribute to the brainstorming. The property should also be very detailed and must be a sentence. It should contain adjective when necessary to better elaborate the similar property of and relationship among the notes in the same group, and distinguish them from the notes in other groups\
Moreover, you also need to calculate the confidence value (in range of 0 to 1) of specific note in the class, which indicates how confident you are to put this note in this class. The value 1 indicates that the note perfectly fits the class, and the value 0 indicates the note has no relation with the class.\
Your task is to 1. return all classes. Each class name is the property of the notes assigned to this class under the consideration of the dimensions. Notice you must analyze notes and figure out the classes *according to the dimensions*. The properties represented by the classes should be different enough in order to generate insightful and meaningful effect for the brainstorming process. In other words, the property should not be too similar. For example, "the object is big" and "the object is large" are similar, so there should not be two classes named "the object is big" and "the object is large"\
2. return all groups that contains the class and the notes and also the confidence value of each note in this group.
Return the result in the provided JSON format, as indicated in the assistantPrompt.`

const assistantPrompt = `The returned JSON objects should follow this format:
{
    "classes": [
        description of the property of class1, description of the property of class2, ...
    ],
    "classification": [
        {
            "class": "description of the property",
            "notes":[
                {"id": 1, "confidence": "0.89"},
                {"id": 3, "confidence": "0.7"},
                {"id": 4, "confidence": "0.6"},
            ]
        },
		{
            "class": "description of the property",
            "notes":[
                {"id": 2, "confidence": "0.4"},
                {"id": 3, "confidence": "0.8"},
            ]
        },
        {
            ...
        }
    ]
}

If the dimension is cost and the notes are "buy a house" (id is 1), "buy a doll" (id is 2), and "buy a meal" (id is 3), then the example of return JSON object:
{
    "classes": [
        "cost of doing so is large", "cost of doing so is small"
    ],
    "classification": [
        {
            "class": "cost of doing so is large",
            "notes":[
                {"id": 1, "confidence": "0.89"},
            ]
        },
		{
            "class": "cost of doing so is small",
            "notes":[
                {"id": 2, "confidence": "0.92"},
                {"id": 3, "confidence": "0.8"},
            ]
        },
        {
            ...
        }
    ]
}

Note you should use node id provided to you in the input JSON object. Also, the value of "class" inside the "classification" must be from the "classes" key.

`

export async function generateGroups (editor: Editor, shape: TLFrameShape, dimensions: string[]) {
	// we can't make anything real if there's nothing selected
	const selectedShapes = editor.getSelectedShapes()
	if (selectedShapes.length === 0) {
		throw new Error('First select something to make real.')
	}

	// first, we build the prompt that we'll send to openai.
	const prompt = await buildPromptForOpenAi(editor, shape, dimensions)

	// TODO: create effect to show loading edges

	try {
		// If you're using the API key input, we preference the key from there.
		// It's okay if this is undefined—it will just mean that we'll use the
		// one in the .env file instead.
		const apiKeyFromDangerousApiKeyInput = (
			document.body.querySelector('#openai_key_risky_but_cool') as HTMLInputElement
		)?.value

		// make a request to openai. `fetchFromOpenAi` is a next.js server action,
		// so our api key is hidden.
		const openAiResponse = await fetchFromOpenAi(apiKeyFromDangerousApiKeyInput, {
			model: 'gpt-4-1106-preview',
			response_format: { type: 'json_object' },
			max_tokens: 4096,
			temperature: 0,
			messages: prompt,
		})

		if (openAiResponse.error) {
			throw new Error(openAiResponse.error.message)
		}

		const response = openAiResponse.choices[0].message.content

		console.log('openAiResponse: ', response)
		const parsed_res = JSON.parse(response)
		return { classes: parsed_res.classes, classification: parsed_res.classification };

		// populate the response shape with the html we got back from openai.
		// TODO: populate the edges between selected shapes
	} catch (e) {
		// if something went wrong, get rid of the unnecessary response shape

		// TODO: create effect to hide loading edges
		throw e
	}
}



async function buildPromptForOpenAi (editor: Editor, shape: TLFrameShape, dimensions: string[]): Promise<GPT4Message[]> {
    if (dimensions.length == 0){
        throw new Error('Please specify the dimensions.')
    }
    // TODO
	// get the text from each note on the frame
	const notes = getNotes(editor, shape)

	// the user messages describe what the user has done and what they want to do next. they'll get
	// combined with the system prompt to tell gpt-4 what we'd like it to do.
	const userMessages: MessageContent = [
		{
			type: 'text',
			text: 'Here are dimensions and the thinking notes. The first is the list of dimension, and the second is a list of JSON format where text means the note content and id means the note id. Please group the notes according to the dimensions and return a json file that contains all the classes and the specific classification result',
		},
        {
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: JSON.stringify(dimensions) !== '' ? JSON.stringify(dimensions) : 'Oh, it looks like there was not any note and dimension.',
		},
		{
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: notes !== '' ? notes : 'Oh, it looks like there was not any note and dimension.',
		},
	]

	// combine the user prompt with the system prompt
	return [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userMessages },
		{ role: 'assistant', content: assistantPrompt },
	]
}

function getNotes (editor: Editor, shape: TLFrameShape) {
    function fetchTextsFromFrame(shapeId: string): Array<{ text: string; id: string }>{
        const noteShapeDescendantIds = editor.getSortedChildIdsForParent(shapeId)

        const textNodes = noteShapeDescendantIds.flatMap(id => {
            const shape = editor.getShape(id)
            if (!shape) return []
            if (
                shape.type === 'text' ||
                shape.type === 'geo' ||
                shape.type === 'arrow' ||
                shape.type === 'note' ||
                shape.type === 'node'
            ){
                return [{ text: shape.props.text, id: shape.id }]
            }
            // if the shape type is frame, recursively dive into the frame and grab the text
            if (shape.type === 'new_frame'){
                return fetchTextsFromFrame(shape.id)
            }
            return []
        })

        return textNodes
    }

    const texts = fetchTextsFromFrame(shape.id)

    const filterTexts = texts.filter(v => v.text !== null && v.text !=='')

	return JSON.stringify(filterTexts)
}
