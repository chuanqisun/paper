Below is a TODO list for work in this repo. We need to address one item at a time, but items of the same category or have co-dependency can be addressed as a group.

When addressing the items, you must first update any relavent insturctions in .github/instructions/\*.instructions.md files.
When you are done addressing the item, you must move it from the `#TODO` list to the `#DONE` list below it.

# TODO

- isGenerating is prematurely flipped to false
- Fix concurrent rendering issue
- Allow user to paste images or upload files to moodboard
- Allow user to type in artifact into the moodboard

# DONE

- In all of the rejection lists, when expanded, expose a "Clear all" button that removes items from rejection list
- Change the pin/reject workflow. When user click Generate Concepts/Artifacts/Design, do NOT move anything to the rejection list. Instead, just append below the existing list.
  - Move the Generate and Manual add buttons to the bottom of the list
  - Add another button that says "Pinned only" and removes unpinned items
