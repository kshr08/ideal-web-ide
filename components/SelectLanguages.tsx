'use client'

import { useState } from 'react'
import { Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/16/solid'
import { CheckIcon } from '@heroicons/react/20/solid'
import { languageOptions } from '@/config/config'
import { AnyAaaaRecord } from 'dns'


function classNames(...classes:string[]) {
    return classes.filter(Boolean).join(" ");
}

export type selectedLanguageOptionProps={
    language: string;
    version: string;
    aliases: string[];
    runtime?: string;
}

export default function SelectLanguages({onSelect, selectedLanguageOption,}:{onSelect:any; selectedLanguageOption:selectedLanguageOptionProps;}) {
  //const [selected, setSelected] = useState(languageOptions[0]);
  function onChange() {
    
  }

  return (
    <Listbox value={selectedLanguageOption} onChange={onSelect}>
      
      <div className="relative">
        <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-gray-800/50 py-1.5 pr-2 pl-3 text-left text-white outline-1 -outline-offset-1 outline-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 sm:text-sm/6">
          <span className="col-start-1 row-start-1 flex items-center gap-3 pr-6">
            <span className="block truncate capitalize">{selectedLanguageOption.language} ({selectedLanguageOption.version})</span>
          </span>
        </ListboxButton>

        <ListboxOptions
          transition
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-gray-800 py-1 text-base outline-1 -outline-offset-1 outline-white/10 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm"
        >
          {languageOptions.map((item) => (
            <ListboxOption
              key={item.language}
              value={item}
              className="group relative cursor-default py-2 pr-9 pl-3 text-white select-none data-focus:bg-indigo-500 data-focus:outline-hidden"
            >
              <div className="flex items-center">
        
                <span className="ml-3 block truncate font-normal group-data-selected:font-semibold capitalize">{item.language} ({item.version})</span>
              </div>

              <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-400 group-not-data-selected:hidden group-data-focus:text-white">
                <CheckIcon aria-hidden="true" className="size-5" />
              </span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}