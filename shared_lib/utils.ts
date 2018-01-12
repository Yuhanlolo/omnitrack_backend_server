export function merge(objA: any, objB: any, overwrite: boolean, recursive: boolean = true): any{
  if(!objA)
  {
    return JSON.parse(JSON.stringify(objB))
  }

  const newObj = JSON.parse(JSON.stringify(objA))
  if(!objB)
  {
    return newObj
  }

  for(let bField in objB)
  {
    if(objB.hasOwnProperty(bField))
    {
      if(objA.hasOwnProperty(bField) && overwrite==false)
      {
        continue;
      }
      else{
        if(recursive==true)
        {
          newObj[bField] = merge(newObj[bField], objB[bField], overwrite, true)
        }
        else{
          newObj[bField] = objB[bField]
        }
      }
    }
  }
  return newObj
}

export function deepclone(obj: any): any{
  return JSON.parse(JSON.stringify(obj))
}

export function isNullOrEmpty(obj: string): boolean{
  return obj == null || obj.length == 0
}


export function isNullOrBlank(obj: string): boolean{
  return obj == null || obj.trim().length == 0
}