#! /bin/bash

# rewrite docker run command, but leave all other untouched
if [ "$2" == "run" ]; then
  # rewrite paths in tracer config
  cat ${ODASA_SNAPSHOT}/working/tracer.config | sed "s:${ODASA_SNAPSHOT}:/opt/codeql/snapshot:g" | sed "s:${ODASA_HOME}:/opt/codeql/dist:g" > ${ODASA_SNAPSHOT}/working/trace-docker.config

  # docker run
  COMMAND=("$1" "$2")
  # mount folders and tracer config
  COMMAND+=("-v" "${ODASA_HOME}:/opt/codeql/dist" "-v" "${ODASA_SNAPSHOT}:/opt/codeql/snapshot" "-v" "${ODASA_SNAPSHOT}/working/trace-docker.config:/opt/codeql/tracer.config")

  # setup tracer env vars
  COMMAND+=("-e" "LD_PRELOAD=/opt/codeql/dist/tools/\${LIB}trace.so")
  COMMAND+=("-e" "ODASA_TRACER_CONFIGURATION=/opt/codeql/tracer.config")
  COMMAND+=("-e" "ODASA_HOME=/opt/codeql/dist")
  COMMAND+=("-e" "ODASA_SNAPSHOT=/opt/codeql/snapshot")
  COMMAND+=("-e" "SOURCE_ARCHIVE=/opt/codeql/snapshot/output/src_archive")
  COMMAND+=("-e" "TRAP_FOLDER=/opt/codeql/snapshot/working/trap")

  # add path transformer variable and file
  COMMAND+=("-e" "SEMMLE_PATH_TRANSFORMER=/opt/codeql/path_transformer.txt")
  COMMAND+=("-v" "${ODASA_SNAPSHOT}/working/path_transformer.txt:/opt/codeql/path_transformer.txt")
  # append original arugments
  COMMAND+=("${@:3}")

  # create path transformer lines for every -v argument
  PREV=""
  echo "" > ${ODASA_SNAPSHOT}/working/path_transformer.txt
  for arg in "${COMMAND[@]}"
  do
    if [ "$PREV" = "-v" ]; then
      echo "#${arg%:*}" >> ${ODASA_SNAPSHOT}/working/path_transformer.txt
      echo "${arg##*:}//" >> ${ODASA_SNAPSHOT}/working/path_transformer.txt
    fi
    PREV="$arg"
  done
  cat ${ODASA_SNAPSHOT}/working/path_transformer.txt

  exec "${COMMAND[@]}"
else
  exec "$@"
fi
